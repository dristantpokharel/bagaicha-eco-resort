"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { revalidateAvailability } from "@/lib/booking/availability-data";
import { BOOKING_TX_OPTIONS, db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ActionError, runAction } from "@/lib/actions";
import { isRoomConflictError, ROOM_CONFLICT_MESSAGE } from "@/lib/booking/availability";
import { formatShortDate, parseDateOnly } from "@/lib/booking/dates";
import { applyBlockMove, applyMove } from "@/lib/booking/tape-service";
import { notifyReservation } from "@/lib/email/booking-emails";
import { formatNpr } from "@/lib/money";

/** What the browser keeps to undo a change: the same action again, with the old values. */
export type UndoInfo =
  | { kind: "move"; bookingId: string; roomId?: string; checkIn?: string; checkOut?: string; notify: boolean }
  | { kind: "block"; blockId: string; roomId: string; startDate: string; endDate: string };

export type TapeResult = { ok: true; message: string; emailed: boolean; undo: UndoInfo | null } | { ok: false; error: string };

const id = z.string().trim().min(1).max(64);
const dateString = z.string().trim().max(10);

const moveSchema = z.object({
  bookingId: id,
  roomId: id.optional(),
  checkIn: dateString.optional(),
  checkOut: dateString.optional(),
  /** Email the guest the updated details afterwards. */
  notify: z.boolean(),
  /** The call is an Undo: only changes the wording. */
  undo: z.boolean().optional(),
});

const blockSchema = z.object({
  blockId: id,
  roomId: id.optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  undo: z.boolean().optional(),
});

function revalidateAdmin() {
  revalidateAvailability();
  revalidatePath("/admin", "layout");
}

/** Runs the body through the shared error handling (permission and rule failures become a message). */
async function run(body: () => Promise<Extract<TapeResult, { ok: true }>>): Promise<TapeResult> {
  let success: Extract<TapeResult, { ok: true }> | undefined;
  const result = await runAction(async () => {
    success = await body();
    return { ok: true, message: success.message };
  });
  return result.ok && success ? success : { ok: false, error: result.ok ? "Something went wrong." : result.error };
}

function parse<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ActionError("That change wasn't understood. Reload the page and try again.");
  return parsed.data;
}

const days = (n: number) => `${n} night${n === 1 ? "" : "s"}`;

/**
 * Moves a room line to another room of its type and/or gives its booking new dates (all open rooms move together).
 * Staff can do this (bookings.manage). Optionally emails the guest the updated details once it has been saved.
 */
export async function moveBookingAction(input: z.input<typeof moveSchema>): Promise<TapeResult> {
  return run(async () => {
    const actor = await requirePermission("bookings.manage");
    const args = parse(moveSchema, input);

    let outcome;
    try {
      outcome = await db.$transaction((tx) => applyMove(tx, actor.id, args), BOOKING_TX_OPTIONS);
    } catch (error) {
      if (isRoomConflictError(error)) throw new ActionError(ROOM_CONFLICT_MESSAGE);
      throw error;
    }
    revalidateAdmin();

    let emailed = false;
    let emailNote = "";
    if (args.notify) {
      try {
        const sent = await notifyReservation("modified", outcome.reservationId);
        emailed = sent.guest === "sent";
        emailNote = emailed
          ? " The guest was emailed the updated details."
          : sent.guest === "skipped"
            ? " The guest has no email address, so no email was sent."
            : " The email to the guest could not be sent.";
      } catch {
        emailNote = " The email to the guest could not be sent.";
      }
    }

    const parts: string[] = [];
    if (outcome.roomChanged) parts.push(`moved to room ${outcome.to.room}`);
    if (outcome.datesChanged) {
      const nights = days(Math.round((Date.parse(outcome.to.checkOut) - Date.parse(outcome.to.checkIn)) / 86_400_000));
      parts.push(`now ${formatShortDate(parseDateOnly(outcome.to.checkIn)!)} to ${formatShortDate(parseDateOnly(outcome.to.checkOut)!)} (${nights})`);
      if (outcome.to.totalNpr !== outcome.from.totalNpr) parts.push(`total ${formatNpr(outcome.to.totalNpr)}, was ${formatNpr(outcome.from.totalNpr)}`);
    }
    const message = `${args.undo ? "Undone: " : `${outcome.reference}: `}${parts.join("; ")}.${emailNote}`;

    return {
      ok: true as const,
      message,
      emailed,
      // Undo puts back what changed, and emails again only if this change emailed the guest.
      undo: args.undo
        ? null
        : {
            kind: "move" as const,
            bookingId: args.bookingId,
            ...(outcome.roomChanged && outcome.from.roomId ? { roomId: outcome.from.roomId } : {}),
            ...(outcome.datesChanged ? { checkIn: outcome.from.checkIn, checkOut: outcome.from.checkOut } : {}),
            notify: emailed,
          },
    };
  });
}

/** Moves or resizes a room block. Admin and Superuser only (rooms.blockDates). */
export async function moveBlockAction(input: z.input<typeof blockSchema>): Promise<TapeResult> {
  return run(async () => {
    const actor = await requirePermission("rooms.blockDates");
    const args = parse(blockSchema, input);

    let outcome;
    try {
      outcome = await db.$transaction((tx) => applyBlockMove(tx, actor.id, args), BOOKING_TX_OPTIONS);
    } catch (error) {
      if (isRoomConflictError(error)) throw new ActionError(ROOM_CONFLICT_MESSAGE);
      throw error;
    }
    revalidateAdmin();

    return {
      ok: true as const,
      message: `${args.undo ? "Undone: block" : "Block"} on room ${outcome.to.room} is now ${formatShortDate(parseDateOnly(outcome.to.startDate)!)} to ${formatShortDate(parseDateOnly(outcome.to.endDate)!)}.`,
      emailed: false,
      undo: args.undo
        ? null
        : { kind: "block" as const, blockId: args.blockId, roomId: outcome.from.roomId, startDate: outcome.from.startDate, endDate: outcome.from.endDate },
    };
  });
}
