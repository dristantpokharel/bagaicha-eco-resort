"use server";

import { revalidatePath } from "next/cache";
import { revalidateAvailability } from "@/lib/booking/availability-data";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import type { BookingStatus } from "@/generated/prisma/enums";
import { BOOKING_TX_OPTIONS, db } from "@/lib/db";
import { requirePermission, type CurrentUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { ActionError, parseForm, runAction, type ActionResult } from "@/lib/actions";
import { formatStayDate, nightsBetween, toDateOnlyString } from "@/lib/booking/dates";
import { todayInResort } from "@/lib/dates";
import { assertRoomAssignable, isRoomConflictError, ROOM_CONFLICT_MESSAGE } from "@/lib/booking/availability";
import { computeQuote } from "@/lib/booking/pricing";
import { validateStay } from "@/lib/booking/rules";
import { createBookingRecord } from "@/lib/booking/service";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/labels";
import { canTransition, editableFlags, permissionForTransition } from "@/lib/booking/status";
import { notifyBooking, type NotifyOutcome } from "@/lib/email/booking-emails";
import { formatNpr } from "@/lib/money";
import {
  bookingIdSchema,
  cancelBookingSchema,
  confirmBookingSchema,
  manualBookingSchema,
  updateBookingSchema,
} from "./schemas";

function revalidateAdmin() {
  revalidateAvailability();
  revalidatePath("/admin", "layout");
}

/** Maps a room-overlap database error to the friendly message; rethrows anything else. */
function rethrowFriendly(error: unknown): never {
  if (isRoomConflictError(error)) throw new ActionError(ROOM_CONFLICT_MESSAGE);
  throw error;
}

function emailNote(outcome: NotifyOutcome | null): string {
  if (!outcome || outcome.guest === "failed") return " The email to the guest could not be sent.";
  if (outcome.guest === "skipped") return " The guest has no email address, so no email was sent.";
  return " An email was sent to the guest.";
}

async function sendGuestEmail(kind: "confirmed" | "cancelled", bookingId: string): Promise<NotifyOutcome | null> {
  try {
    return await notifyBooking(kind, bookingId);
  } catch {
    return null;
  }
}

// ─── Create ──────────────────────────────────────────────────────────────────

/** Staff entering a phone / walk-in booking. A room makes it CONFIRMED straight away. */
export async function createManualBooking(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let createdId: string | null = null;
  let emailed = "none";

  const result = await runAction(async () => {
    const actor = await requirePermission("bookings.manage");
    const input = parseForm(manualBookingSchema, formData);
    if (input.roomId) await requirePermission("bookings.changeStatus");

    const roomType = await db.roomType.findUnique({ where: { id: input.roomTypeId } });
    if (!roomType?.isActive) throw new ActionError("Choose an active room type.", { roomTypeId: "Choose a room type." });

    const stay = validateStay(input, { today: todayInResort(), publicRequest: false, capacity: roomType });
    if (!stay.ok) throw new ActionError(Object.values(stay.errors)[0], stay.errors);

    try {
      createdId = await db.$transaction(async (tx) => {
        const created = await createBookingRecord(tx, {
          roomType,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          adults: input.adults,
          children: input.children,
          guest: { name: input.name, email: input.email, phone: input.phone, country: input.country },
          source: input.source,
          specialRequests: input.specialRequests,
          internalNotes: input.internalNotes,
          createdById: actor.id,
          roomId: input.roomId,
        });
        await logActivity(tx, {
          userId: actor.id,
          action: "booking.created",
          entityType: "Booking",
          entityId: created.booking.id,
          details: {
            bookingNumber: created.booking.bookingNumber,
            source: input.source,
            status: created.booking.status,
            roomType: roomType.name,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            totalPriceNpr: created.quote.totalPriceNpr,
          },
        });
        return created.booking.id;
      }, BOOKING_TX_OPTIONS);
    } catch (error) {
      rethrowFriendly(error);
    }

    if (input.roomId && createdId) {
      const outcome = await sendGuestEmail("confirmed", createdId);
      emailed = !outcome || outcome.guest === "failed" ? "failed" : outcome.guest;
    }
    revalidateAdmin();
    return { ok: true, message: "Booking created." };
  });

  // redirect() throws, so it runs outside runAction's try/catch.
  if (result.ok && createdId) redirect(`/admin/bookings/${createdId}?created=1&emailed=${emailed}`);
  return result;
}

// ─── Edit ────────────────────────────────────────────────────────────────────

export async function updateBooking(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("bookings.manage");
    const input = parseForm(updateBookingSchema, formData);
    let message = "Booking saved.";

    try {
      await db.$transaction(async (tx) => {
        const before = await tx.booking.findUnique({ where: { id: input.bookingId }, include: { roomType: true } });
        if (!before) throw new ActionError("That booking no longer exists.");
        const flags = editableFlags(before.status);

        // Only editable parts are taken from the form; the rest keep their stored values.
        const checkInStr = flags.checkIn && input.checkIn ? input.checkIn : toDateOnlyString(before.checkIn);
        const checkOutStr = flags.checkOut && input.checkOut ? input.checkOut : toDateOnlyString(before.checkOut);
        const adults = flags.party && input.adults !== undefined ? input.adults : before.adults;
        const children = flags.party && input.children !== undefined ? input.children : before.children;

        let roomType = before.roomType;
        if (flags.roomType && input.roomTypeId && input.roomTypeId !== before.roomTypeId) {
          const next = await tx.roomType.findUnique({ where: { id: input.roomTypeId } });
          if (!next?.isActive) throw new ActionError("Choose an active room type.");
          roomType = next;
        }
        const typeChanged = roomType.id !== before.roomTypeId;

        const stay = validateStay(
          { checkIn: checkInStr, checkOut: checkOutStr, adults, children },
          { today: todayInResort(), publicRequest: false, capacity: roomType },
        );
        // Closed bookings (checked out / cancelled) only take notes, so skip stay rules for them.
        const closed = !flags.checkIn && !flags.checkOut;
        if (!stay.ok && !closed) throw new ActionError(Object.values(stay.errors)[0], stay.errors);
        const checkIn = stay.ok ? stay.checkIn : before.checkIn;
        const checkOut = stay.ok ? stay.checkOut : before.checkOut;

        const roomId = before.status === "PENDING" || closed ? before.roomId : flags.room && input.roomId ? input.roomId : before.roomId;
        const datesOrRoomChanged =
          checkIn.getTime() !== before.checkIn.getTime() ||
          checkOut.getTime() !== before.checkOut.getTime() ||
          roomId !== before.roomId;
        if ((before.status === "CONFIRMED" || before.status === "CHECKED_IN") && roomId && datesOrRoomChanged) {
          await assertRoomAssignable(tx, {
            roomId,
            roomTypeId: roomType.id,
            checkIn,
            checkOut,
            excludeBookingId: before.id,
          });
        }

        // Keep the booking's own rates unless the room type changed (then that type's current rates apply).
        const pricePerNightNpr = typeChanged ? roomType.basePriceNpr : before.pricePerNightNpr;
        const childPricePerNightNpr = typeChanged ? roomType.childPricePerNightNpr : before.childPricePerNightNpr;
        const quote = computeQuote({
          nights: nightsBetween(checkIn, checkOut),
          pricePerNightNpr,
          childPricePerNightNpr,
          children,
        });

        const next = {
          roomTypeId: roomType.id,
          roomId,
          checkIn,
          checkOut,
          adults,
          children,
          pricePerNightNpr,
          childPricePerNightNpr,
          totalPriceNpr: quote.totalPriceNpr,
          specialRequests: flags.guestRequests ? (input.specialRequests ?? null) : before.specialRequests,
          internalNotes: flags.notes ? (input.internalNotes ?? null) : before.internalNotes,
        } satisfies Prisma.BookingUncheckedUpdateInput;

        const serialize = (v: unknown) => (v instanceof Date ? toDateOnlyString(v) : v);
        // Free text typed about a guest: the log records that it changed, never the text.
        const FREE_TEXT: readonly string[] = ["specialRequests", "internalNotes"];
        const changes: Record<string, { from: unknown; to: unknown } | "edited"> = {};
        for (const key of Object.keys(next) as (keyof typeof next)[]) {
          const from = serialize(before[key]);
          const to = serialize(next[key]);
          if (from !== to) changes[key] = FREE_TEXT.includes(key) ? "edited" : { from, to };
        }
        if (Object.keys(changes).length === 0) {
          message = "No changes to save.";
          return;
        }

        await tx.booking.update({ where: { id: before.id }, data: next });
        await logActivity(tx, {
          userId: actor.id,
          action: "booking.updated",
          entityType: "Booking",
          entityId: before.id,
          details: { bookingNumber: before.bookingNumber, changes: changes as Prisma.InputJsonObject },
        });
        if (quote.totalPriceNpr !== before.totalPriceNpr) {
          message = `Booking saved. The total is now ${formatNpr(quote.totalPriceNpr)} (was ${formatNpr(before.totalPriceNpr)}).`;
        }
      }, BOOKING_TX_OPTIONS);
    } catch (error) {
      rethrowFriendly(error);
    }

    revalidateAdmin();
    return { ok: true, message };
  });
}

// ─── Status changes ──────────────────────────────────────────────────────────

/**
 * Moves a booking to the next status inside one transaction. The status is part
 * of the update's WHERE clause, so two people acting at once can't both succeed.
 */
async function changeStatus(params: {
  bookingId: string;
  to: BookingStatus;
  actor: CurrentUser;
  action: string;
  prepare?: (tx: Prisma.TransactionClient, booking: Prisma.BookingGetPayload<object>) => Promise<Prisma.BookingUncheckedUpdateManyInput>;
  details?: (booking: Prisma.BookingGetPayload<object>) => Prisma.InputJsonObject;
}) {
  const { bookingId, to, actor } = params;
  try {
    await db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!booking) throw new ActionError("That booking no longer exists.");
      if (!canTransition(booking.status, to)) {
        throw new ActionError(
          `This booking is ${BOOKING_STATUS_LABELS[booking.status].toLowerCase()}, so it can't be moved to ${BOOKING_STATUS_LABELS[to].toLowerCase()}. Reload the page.`,
        );
      }
      const data = (await params.prepare?.(tx, booking)) ?? {};
      const updated = await tx.booking.updateMany({ where: { id: bookingId, status: booking.status }, data: { ...data, status: to } });
      if (updated.count !== 1) throw new ActionError("Someone else just changed this booking. Reload the page and try again.");
      await logActivity(tx, {
        userId: actor.id,
        action: params.action,
        entityType: "Booking",
        entityId: bookingId,
        details: { bookingNumber: booking.bookingNumber, from: booking.status, to, ...params.details?.(booking) },
      });
    }, BOOKING_TX_OPTIONS);
  } catch (error) {
    rethrowFriendly(error);
  }
}

export async function confirmBooking(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission(permissionForTransition("CONFIRMED"));
    const { bookingId, roomId } = parseForm(confirmBookingSchema, formData);

    await changeStatus({
      bookingId,
      to: "CONFIRMED",
      actor,
      action: "booking.confirmed",
      // Re-checked inside the transaction with the room locked: room active, right type, no block, no overlap.
      prepare: async (tx, booking) => {
        await assertRoomAssignable(tx, {
          roomId,
          roomTypeId: booking.roomTypeId,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          excludeBookingId: booking.id,
        });
        return { roomId, confirmedAt: new Date() };
      },
      details: () => ({ roomId }),
    });

    const outcome = await sendGuestEmail("confirmed", bookingId);
    revalidateAdmin();
    return { ok: true, message: `Booking confirmed.${emailNote(outcome)}` };
  });
}

export async function checkInBooking(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission(permissionForTransition("CHECKED_IN"));
    const { bookingId } = parseForm(bookingIdSchema, formData);
    await changeStatus({
      bookingId,
      to: "CHECKED_IN",
      actor,
      action: "booking.checkedIn",
      prepare: async (_tx, booking) => {
        if (booking.checkIn > todayInResort()) {
          throw new ActionError(`Check-in opens on ${formatStayDate(booking.checkIn)}.`);
        }
        return { checkedInAt: new Date() };
      },
    });
    revalidateAdmin();
    return { ok: true, message: "Guest checked in." };
  });
}

export async function checkOutBooking(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission(permissionForTransition("CHECKED_OUT"));
    const { bookingId } = parseForm(bookingIdSchema, formData);
    await changeStatus({
      bookingId,
      to: "CHECKED_OUT",
      actor,
      action: "booking.checkedOut",
      prepare: async () => ({ checkedOutAt: new Date() }),
    });
    revalidateAdmin();
    return { ok: true, message: "Guest checked out." };
  });
}

export async function cancelBooking(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    // Staff can't cancel: bookings.cancel is Admin and Superuser only.
    const actor = await requirePermission(permissionForTransition("CANCELLED"));
    const { bookingId, reason } = parseForm(cancelBookingSchema, formData);
    await changeStatus({
      bookingId,
      to: "CANCELLED",
      actor,
      action: "booking.cancelled",
      prepare: async () => ({ cancelledAt: new Date(), cancellationReason: reason }),
      details: () => ({ reason }),
    });
    const outcome = await sendGuestEmail("cancelled", bookingId);
    revalidateAdmin();
    return { ok: true, message: `Booking cancelled.${emailNote(outcome)}` };
  });
}
