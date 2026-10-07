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
import { partyProblem } from "@/lib/booking/capacity";
import { computeQuote } from "@/lib/booking/pricing";
import { validateStay } from "@/lib/booking/rules";
import { validateSplit } from "@/lib/booking/multi-room";
import { createReservationRecord } from "@/lib/booking/service";
import {
  cancelLineWithReason,
  cancelOpenLines,
  confirmAllPending,
  confirmLineInRoom,
  linkToNewGuest,
  lockReservation,
  syncTotal,
  transitionLine,
  updateGuestFromSnapshot,
} from "@/lib/booking/reservation-service";
import { resolutionEmail } from "@/lib/booking/reservation-status";
import { editableFlags, permissionForTransition, reservationDateFlags } from "@/lib/booking/status";
import { notifyReservation, type NotifyOutcome } from "@/lib/email/booking-emails";
import { formatNpr } from "@/lib/money";
import {
  cancelLineSchema,
  cancelReservationSchema,
  guestFixSchema,
  confirmLineSchema,
  lineIdSchema,
  manualBookingSchema,
  reservationIdSchema,
  updateLineSchema,
  updateReservationSchema,
} from "./schemas";

type Tx = Prisma.TransactionClient;

function revalidateAdmin() {
  revalidateAvailability();
  revalidatePath("/admin", "layout");
}

/** Maps a room-overlap database error to the friendly message; rethrows anything else. */
function rethrowFriendly(error: unknown): never {
  if (isRoomConflictError(error)) throw new ActionError(ROOM_CONFLICT_MESSAGE);
  throw error;
}

function emailNote(outcome: NotifyOutcome | null | "none"): string {
  if (outcome === "none") return "";
  if (!outcome || outcome.guest === "failed") return " The email to the guest could not be sent.";
  if (outcome.guest === "skipped") return " The guest has no email address, so no email was sent.";
  return " An email was sent to the guest.";
}

/**
 * After a change that decided a room: once no room is pending, the guest gets one email for the whole
 * reservation (confirmed, partly confirmed or cancelled). While rooms are still pending nothing is sent.
 */
async function emailIfResolved(reservationId: string): Promise<NotifyOutcome | null | "none"> {
  const lines = await db.booking.findMany({ where: { reservationId }, select: { status: true } });
  const kind = resolutionEmail(lines);
  if (!kind) return "none";
  try {
    return await notifyReservation(kind, reservationId);
  } catch {
    return null;
  }
}

// ─── Create ──────────────────────────────────────────────────────────────────

/** Staff entering a phone / walk-in booking for one or more rooms. A room on a line makes that line CONFIRMED. */
export async function createManualBooking(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let createdId: string | null = null;
  let emailed = "none";

  const result = await runAction(async () => {
    const actor = await requirePermission("bookings.manage");
    const input = parseForm(manualBookingSchema, formData);
    if (input.rooms.some((r) => r.roomId)) await requirePermission("bookings.changeStatus");

    const typeIds = [...new Set(input.rooms.map((r) => r.roomTypeId))];
    const found = await db.roomType.findMany({ where: { id: { in: typeIds }, isActive: true } });
    if (found.length !== typeIds.length) throw new ActionError("Choose active room types.", { rooms: "Choose active room types." });
    const roomTypes = new Map(found.map((t) => [t.id, t]));

    const party = input.rooms.reduce((p, r) => ({ adults: p.adults + r.adults, children: p.children + r.children }), { adults: 0, children: 0 });
    const stay = validateStay({ ...input, ...party, adults: Math.max(party.adults, 1) }, { today: todayInResort(), publicRequest: false });
    if (!stay.ok) throw new ActionError(Object.values(stay.errors)[0], stay.errors);
    // Staff are not held to the online room limit; each room must still suit its guests.
    const split = validateSplit(input.rooms, roomTypes, party, { maxRooms: null });
    if (!split.ok) {
      const message = Object.values(split.lineErrors)[0] ?? split.errors[0];
      throw new ActionError(message, { rooms: message });
    }

    try {
      createdId = await db.$transaction(async (tx) => {
        const created = await createReservationRecord(tx, {
          roomTypes,
          lines: input.rooms,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          guest: { name: input.name, email: input.email, phone: input.phone, country: input.country },
          source: input.source,
          specialRequests: input.specialRequests,
          internalNotes: input.internalNotes,
          createdById: actor.id,
          maxRooms: null,
        });
        await logActivity(tx, {
          userId: actor.id,
          action: "reservation.created",
          entityType: "Reservation",
          entityId: created.reservation.id,
          details: {
            reference: created.reservation.reference,
            source: input.source,
            rooms: created.bookings.map((b) => roomTypes.get(b.roomTypeId)!.name),
            statuses: created.bookings.map((b) => b.status),
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            totalPriceNpr: created.quote.totalPriceNpr,
          },
        });
        return created.reservation.id;
      }, BOOKING_TX_OPTIONS);
    } catch (error) {
      rethrowFriendly(error);
    }

    if (createdId) {
      const outcome = await emailIfResolved(createdId);
      emailed = outcome === "none" ? "none" : !outcome || outcome.guest === "failed" ? "failed" : outcome.guest;
    }
    revalidateAdmin();
    return { ok: true, message: "Booking created." };
  });

  // redirect() throws, so it runs outside runAction's try/catch.
  if (result.ok && createdId) redirect(`/admin/bookings/${createdId}?created=1&emailed=${emailed}`);
  return result;
}

// ─── Edit ────────────────────────────────────────────────────────────────────

const serialize = (v: unknown) => (v instanceof Date ? toDateOnlyString(v) : v);
/** Free text typed about a guest: the log records that it changed, never the text. */
const FREE_TEXT: readonly string[] = ["specialRequests", "internalNotes"];

function diff<T extends Record<string, unknown>>(before: Record<string, unknown>, next: T) {
  const changes: Record<string, { from: unknown; to: unknown } | "edited"> = {};
  for (const key of Object.keys(next)) {
    const from = serialize(before[key]);
    const to = serialize(next[key]);
    if (from !== to) changes[key] = FREE_TEXT.includes(key) ? "edited" : { from, to };
  }
  return changes;
}

/** Reservation-level edit: dates (moved for every open room together), the guest's requests and staff notes. */
export async function updateReservation(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("bookings.manage");
    const input = parseForm(updateReservationSchema, formData);
    let message = "Reservation saved.";

    try {
      await db.$transaction(async (tx) => {
        await lockReservation(tx, input.reservationId);
        const before = await tx.reservation.findUnique({ where: { id: input.reservationId }, include: { bookings: true } });
        if (!before) throw new ActionError("That booking no longer exists.");
        const flags = reservationDateFlags(before.bookings.map((b) => b.status));

        const checkInStr = flags.checkIn && input.checkIn ? input.checkIn : toDateOnlyString(before.checkIn);
        const checkOutStr = flags.checkOut && input.checkOut ? input.checkOut : toDateOnlyString(before.checkOut);
        const stay = validateStay({ checkIn: checkInStr, checkOut: checkOutStr, adults: 1, children: 0 }, { today: todayInResort(), publicRequest: false });
        if (!stay.ok && (flags.checkIn || flags.checkOut)) throw new ActionError(Object.values(stay.errors)[0], stay.errors);
        const checkIn = stay.ok ? stay.checkIn : before.checkIn;
        const checkOut = stay.ok ? stay.checkOut : before.checkOut;
        const datesChanged = checkIn.getTime() !== before.checkIn.getTime() || checkOut.getTime() !== before.checkOut.getTime();

        const nights = nightsBetween(checkIn, checkOut);
        const open = before.bookings.filter((b) => b.status !== "CANCELLED" && b.status !== "CHECKED_OUT");
        if (datesChanged) {
          // Every open room must still be free (and unblocked) for the new dates; rooms are locked in a fixed order.
          const withRoom = open.filter((b) => b.roomId && (b.status === "CONFIRMED" || b.status === "CHECKED_IN"));
          for (const b of [...withRoom].sort((x, y) => x.roomId!.localeCompare(y.roomId!))) {
            await assertRoomAssignable(tx, { roomId: b.roomId!, roomTypeId: b.roomTypeId, checkIn, checkOut, excludeBookingId: b.id });
          }
          for (const b of open) {
            const quote = computeQuote({
              nights,
              pricePerNightNpr: b.pricePerNightNpr,
              childPricePerNightNpr: b.childPricePerNightNpr,
              children: b.children,
            });
            await tx.booking.update({ where: { id: b.id }, data: { checkIn, checkOut, totalPriceNpr: quote.totalPriceNpr } });
          }
        }

        const next = {
          checkIn,
          checkOut,
          specialRequests: input.specialRequests ?? null,
          internalNotes: input.internalNotes ?? null,
        };
        const changes = diff(before, next);
        if (Object.keys(changes).length === 0) {
          message = "No changes to save.";
          return;
        }
        await tx.reservation.update({ where: { id: before.id }, data: next });
        await syncTotal(tx, before.id);
        await logActivity(tx, {
          userId: actor.id,
          action: "reservation.updated",
          entityType: "Reservation",
          entityId: before.id,
          details: { reference: before.reference, changes: changes as Prisma.InputJsonObject },
        });
        if (datesChanged) {
          const total = (await tx.reservation.findUnique({ where: { id: before.id }, select: { totalPriceNpr: true } }))!.totalPriceNpr;
          if (total !== before.totalPriceNpr) message = `Reservation saved. The total is now ${formatNpr(total)} (was ${formatNpr(before.totalPriceNpr)}).`;
        }
      }, BOOKING_TX_OPTIONS);
    } catch (error) {
      rethrowFriendly(error);
    }

    revalidateAdmin();
    return { ok: true, message };
  });
}

/** The submitted details differ from the saved guest: copy them onto that guest. */
export async function updateGuestFromSubmitted(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("bookings.manage");
    const input = parseForm(guestFixSchema, formData);
    await db.$transaction(async (tx) => {
      const done = await updateGuestFromSnapshot(tx, input.reservationId, input.guestId);
      await logActivity(tx, {
        userId: actor.id,
        action: "reservation.guest_updated",
        entityType: "Reservation",
        entityId: input.reservationId,
        // Field names only: contact details stay out of the log.
        details: { reference: done.reference, guestId: done.guestId, fields: done.fields },
      });
    }, BOOKING_TX_OPTIONS);
    revalidateAdmin();
    return { ok: true, message: "Guest updated with the submitted details." };
  });
}

/** The submitted details belong to someone else: keep the saved guest as is and link this booking to a new one. */
export async function linkToNewGuestAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("bookings.manage");
    const input = parseForm(guestFixSchema, formData);
    await db.$transaction(async (tx) => {
      const done = await linkToNewGuest(tx, input.reservationId, input.guestId);
      await logActivity(tx, {
        userId: actor.id,
        action: "reservation.guest_relinked",
        entityType: "Reservation",
        entityId: input.reservationId,
        details: { reference: done.reference, fromGuestId: done.fromGuestId, toGuestId: done.guestId, fields: done.fields },
      });
    }, BOOKING_TX_OPTIONS);
    revalidateAdmin();
    return { ok: true, message: "Linked to a new guest." };
  });
}

/** Edit one room line: its guests, its room type (while pending) or its room (once confirmed). */
export async function updateBookingLine(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("bookings.manage");
    const input = parseForm(updateLineSchema, formData);
    let message = "Room saved.";

    try {
      await db.$transaction(async (tx) => {
        const peek = await tx.booking.findUnique({ where: { id: input.bookingId }, select: { reservationId: true } });
        if (!peek) throw new ActionError("That room no longer exists.");
        await lockReservation(tx, peek.reservationId);
        const before = await tx.booking.findUnique({ where: { id: input.bookingId }, include: { roomType: true, reservation: { select: { reference: true } } } });
        if (!before) throw new ActionError("That room no longer exists.");
        const flags = editableFlags(before.status);

        const adults = flags.party && input.adults !== undefined ? input.adults : before.adults;
        const children = flags.party && input.children !== undefined ? input.children : before.children;

        let roomType = before.roomType;
        if (flags.roomType && input.roomTypeId && input.roomTypeId !== before.roomTypeId) {
          const next = await tx.roomType.findUnique({ where: { id: input.roomTypeId } });
          if (!next?.isActive) throw new ActionError("Choose an active room type.");
          roomType = next;
        }
        const typeChanged = roomType.id !== before.roomTypeId;

        if (flags.party || typeChanged) {
          const problem = partyProblem(roomType, { adults, children });
          if (problem) throw new ActionError(problem.message, { [problem.field]: problem.message });
        }

        const roomId = flags.room && input.roomId ? input.roomId : before.roomId;
        if ((before.status === "CONFIRMED" || before.status === "CHECKED_IN") && roomId && roomId !== before.roomId) {
          await assertRoomAssignable(tx, { roomId, roomTypeId: roomType.id, checkIn: before.checkIn, checkOut: before.checkOut, excludeBookingId: before.id });
        }

        // Keep the room's own rates unless its type changed (then that type's current rates apply).
        const pricePerNightNpr = typeChanged ? roomType.basePriceNpr : before.pricePerNightNpr;
        const childPricePerNightNpr = typeChanged ? roomType.childPricePerNightNpr : before.childPricePerNightNpr;
        const quote = computeQuote({ nights: nightsBetween(before.checkIn, before.checkOut), pricePerNightNpr, childPricePerNightNpr, children });

        const next = {
          roomTypeId: roomType.id,
          roomId,
          adults,
          children,
          pricePerNightNpr,
          childPricePerNightNpr,
          totalPriceNpr: quote.totalPriceNpr,
        } satisfies Prisma.BookingUncheckedUpdateInput;
        const changes = diff(before, next);
        if (Object.keys(changes).length === 0) {
          message = "No changes to save.";
          return;
        }

        await tx.booking.update({ where: { id: before.id }, data: next });
        await syncTotal(tx, before.reservationId);
        await logActivity(tx, {
          userId: actor.id,
          action: "reservation.roomUpdated",
          entityType: "Reservation",
          entityId: before.reservationId,
          details: { reference: before.reservation.reference, roomType: before.roomType.name, changes: changes as Prisma.InputJsonObject },
        });
        if (quote.totalPriceNpr !== before.totalPriceNpr) {
          message = `Room saved. Its total is now ${formatNpr(quote.totalPriceNpr)} (was ${formatNpr(before.totalPriceNpr)}).`;
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

/** Runs one room's status change and its activity-log entry in one transaction. Returns the reservation's id. */
async function changeLineStatus(params: {
  bookingId: string;
  actor: CurrentUser;
  action: string;
  to: BookingStatus;
  change: (tx: Tx) => Promise<Awaited<ReturnType<typeof transitionLine>>>;
  details?: (line: Awaited<ReturnType<typeof transitionLine>>) => Prisma.InputJsonObject;
}): Promise<string> {
  try {
    return await db.$transaction(async (tx) => {
      const line = await params.change(tx);
      await logActivity(tx, {
        userId: params.actor.id,
        action: params.action,
        entityType: "Reservation",
        entityId: line.reservationId,
        details: { reference: line.reservation.reference, bookingId: params.bookingId, from: line.status, to: params.to, ...params.details?.(line) },
      });
      return line.reservationId;
    }, BOOKING_TX_OPTIONS);
  } catch (error) {
    rethrowFriendly(error);
  }
}

export async function confirmLine(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission(permissionForTransition("CONFIRMED"));
    const { bookingId, roomId } = parseForm(confirmLineSchema, formData);

    const reservationId = await changeLineStatus({
      bookingId,
      actor,
      to: "CONFIRMED",
      action: "reservation.roomConfirmed",
      // Re-checked inside the transaction with the room locked: room active, right type, no block, no overlap.
      change: (tx) => confirmLineInRoom(tx, bookingId, roomId),
      details: () => ({ roomId }),
    });

    const outcome = await emailIfResolved(reservationId);
    revalidateAdmin();
    return { ok: true, message: `Room confirmed.${emailNote(outcome)}` };
  });
}

/**
 * Confirms every pending room in one transaction, giving each a free room of its type. All or nothing: if any
 * type has fewer free rooms than pending lines, nothing is confirmed and the message says which.
 */
export async function confirmAllLines(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission(permissionForTransition("CONFIRMED"));
    const { reservationId } = parseForm(reservationIdSchema, formData);
    let count = 0;

    try {
      await db.$transaction(async (tx) => {
        const { reference, confirmed } = await confirmAllPending(tx, reservationId);
        count = confirmed;
        await logActivity(tx, {
          userId: actor.id,
          action: "reservation.allConfirmed",
          entityType: "Reservation",
          entityId: reservationId,
          details: { reference, rooms: count },
        });
      }, BOOKING_TX_OPTIONS);
    } catch (error) {
      rethrowFriendly(error);
    }

    const outcome = await emailIfResolved(reservationId);
    revalidateAdmin();
    return { ok: true, message: `${count === 1 ? "1 room" : `${count} rooms`} confirmed.${emailNote(outcome)}` };
  });
}

export async function checkInLine(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission(permissionForTransition("CHECKED_IN"));
    const { bookingId } = parseForm(lineIdSchema, formData);
    await changeLineStatus({
      bookingId,
      actor,
      to: "CHECKED_IN",
      action: "reservation.roomCheckedIn",
      change: (tx) =>
        transitionLine(tx, bookingId, "CHECKED_IN", async (line) => {
          if (line.checkIn > todayInResort()) throw new ActionError(`Check-in opens on ${formatStayDate(line.checkIn)}.`);
          return { checkedInAt: new Date() };
        }),
    });
    revalidateAdmin();
    return { ok: true, message: "Guests checked in." };
  });
}

export async function checkOutLine(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission(permissionForTransition("CHECKED_OUT"));
    const { bookingId } = parseForm(lineIdSchema, formData);
    await changeLineStatus({
      bookingId,
      actor,
      to: "CHECKED_OUT",
      action: "reservation.roomCheckedOut",
      change: (tx) => transitionLine(tx, bookingId, "CHECKED_OUT", async () => ({ checkedOutAt: new Date() })),
    });
    revalidateAdmin();
    return { ok: true, message: "Guests checked out." };
  });
}

export async function cancelLine(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    // Staff can't cancel: bookings.cancel is Admin and Superuser only.
    const actor = await requirePermission(permissionForTransition("CANCELLED"));
    const { bookingId, reason } = parseForm(cancelLineSchema, formData);
    const reservationId = await changeLineStatus({
      bookingId,
      actor,
      to: "CANCELLED",
      action: "reservation.roomCancelled",
      change: (tx) => cancelLineWithReason(tx, bookingId, reason),
      details: () => ({ reason }),
    });
    const outcome = await emailIfResolved(reservationId);
    revalidateAdmin();
    return { ok: true, message: `Room cancelled.${emailNote(outcome)}` };
  });
}

/** Cancels every room that can still be cancelled (pending or confirmed) with one reason. */
export async function cancelReservation(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission(permissionForTransition("CANCELLED"));
    const { reservationId, reason } = parseForm(cancelReservationSchema, formData);
    let count = 0;

    await db.$transaction(async (tx) => {
      const { reference, cancelled } = await cancelOpenLines(tx, reservationId, reason);
      count = cancelled;
      await logActivity(tx, {
        userId: actor.id,
        action: "reservation.allCancelled",
        entityType: "Reservation",
        entityId: reservationId,
        details: { reference, rooms: count, reason },
      });
    }, BOOKING_TX_OPTIONS);

    const outcome = await emailIfResolved(reservationId);
    revalidateAdmin();
    return { ok: true, message: `${count === 1 ? "1 room" : `${count} rooms`} cancelled.${emailNote(outcome)}` };
  });
}
