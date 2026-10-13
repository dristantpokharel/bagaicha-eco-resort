import type { Prisma } from "@/generated/prisma/client";
import { ActionError } from "@/lib/actions";
import { logActivity } from "@/lib/activity-log";
import { todayInResort } from "@/lib/dates";
import { OCCUPYING_STATUSES, assertRoomAssignable, lockRoom } from "./availability";
import { nightsBetween, parseDateOnly, toDateOnlyString } from "./dates";
import { BOOKING_STATUS_LABELS } from "./labels";
import { lockReservation, moveOpenLines, syncTotal } from "./reservation-service";
import { validateStay } from "./rules";
import { reservationDateFlags } from "./status";

type Tx = Prisma.TransactionClient;
type Reservation = Prisma.ReservationGetPayload<{ include: { bookings: true } }>;

/**
 * Tape-chart changes: move a room line to another room of its type and/or give its reservation new dates, and
 * move or resize a block. Both reuse the booking rules (status flags, validateStay, assertRoomAssignable,
 * moveOpenLines), so a drag can do nothing the booking page couldn't. Each function runs inside a transaction.
 */

// ─── Bookings ────────────────────────────────────────────────────────────────

export type MoveInput = {
  bookingId: string;
  /** The room to move to; leave out to keep the current one. */
  roomId?: string;
  /** New dates ("yyyy-mm-dd"); leave out to keep them. */
  checkIn?: string;
  checkOut?: string;
};

export type MovePlan = {
  roomId: string | null;
  checkIn: Date;
  checkOut: Date;
  roomChanged: boolean;
  datesChanged: boolean;
};

/** Decides whether a move is allowed by the status and date rules (no database access). Throws ActionError if not. */
export function planMove(reservation: Reservation, input: MoveInput, today: Date): MovePlan {
  const line = reservation.bookings.find((b) => b.id === input.bookingId);
  if (!line) throw new ActionError("That room no longer exists.");
  if (line.status !== "PENDING" && line.status !== "CONFIRMED" && line.status !== "CHECKED_IN") {
    throw new ActionError(`This room is ${BOOKING_STATUS_LABELS[line.status].toLowerCase()}, so it can't be changed.`);
  }

  const roomChanged = input.roomId !== undefined && input.roomId !== line.roomId;
  if (roomChanged) {
    if (line.status === "PENDING") throw new ActionError("A pending room gets its room with Assign & confirm.");
    if (line.status === "CHECKED_IN") throw new ActionError("Guests who are in stay in their room.");
  }

  const flags = reservationDateFlags(reservation.bookings.map((b) => b.status));
  const checkInStr = input.checkIn ?? toDateOnlyString(reservation.checkIn);
  const checkOutStr = input.checkOut ?? toDateOnlyString(reservation.checkOut);
  const checkInChanged = checkInStr !== toDateOnlyString(reservation.checkIn);
  const checkOutChanged = checkOutStr !== toDateOnlyString(reservation.checkOut);
  if (checkInChanged && !flags.checkIn) throw new ActionError("Check-in can't change once guests are in or checked out.");
  if (checkOutChanged && !flags.checkOut) throw new ActionError("This booking can't end on another day any more.");

  const stay = validateStay({ checkIn: checkInStr, checkOut: checkOutStr, adults: 1, children: 0 }, { today, publicRequest: false });
  if (!stay.ok) throw new ActionError(Object.values(stay.errors)[0], stay.errors);

  return {
    roomId: roomChanged ? input.roomId! : line.roomId,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    roomChanged,
    datesChanged: checkInChanged || checkOutChanged,
  };
}

export type MoveOutcome = {
  reservationId: string;
  reference: string;
  roomChanged: boolean;
  datesChanged: boolean;
  from: { roomId: string | null; room: string | null; checkIn: string; checkOut: string; totalNpr: number };
  to: { room: string | null; checkIn: string; checkOut: string; totalNpr: number };
  /** Open rooms that moved together with the dates. */
  rooms: number;
};

async function roomNames(tx: Tx, ids: (string | null)[]) {
  const wanted = ids.filter((id): id is string => !!id);
  const rooms = await tx.room.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } });
  return new Map(rooms.map((r) => [r.id, r.name]));
}

/**
 * Moves one room line to another room of its type and/or the reservation to new dates, atomically. The reservation
 * is locked, every affected room is locked and re-checked (free, unblocked, right type), and rooms are repriced from
 * their own snapshot rates. The database's overlap constraint remains the backstop (callers map it to a message).
 */
export async function applyMove(tx: Tx, actorId: string, input: MoveInput): Promise<MoveOutcome> {
  const peek = await tx.booking.findUnique({ where: { id: input.bookingId }, select: { reservationId: true } });
  if (!peek) throw new ActionError("That room no longer exists.");
  await lockReservation(tx, peek.reservationId);
  const before = await tx.reservation.findUnique({ where: { id: peek.reservationId }, include: { bookings: true } });
  if (!before) throw new ActionError("That booking no longer exists.");

  const plan = planMove(before, input, todayInResort());
  const line = before.bookings.find((b) => b.id === input.bookingId)!;
  const names = await roomNames(tx, [line.roomId, plan.roomId]);
  const outcome = (afterTotal: number): MoveOutcome => ({
    reservationId: before.id,
    reference: before.reference,
    roomChanged: plan.roomChanged,
    datesChanged: plan.datesChanged,
    from: { roomId: line.roomId, room: line.roomId ? (names.get(line.roomId) ?? null) : null, checkIn: toDateOnlyString(before.checkIn), checkOut: toDateOnlyString(before.checkOut), totalNpr: before.totalPriceNpr },
    to: { room: plan.roomId ? (names.get(plan.roomId) ?? null) : null, checkIn: toDateOnlyString(plan.checkIn), checkOut: toDateOnlyString(plan.checkOut), totalNpr: afterTotal },
    rooms: before.bookings.filter((b) => b.status !== "CANCELLED" && b.status !== "CHECKED_OUT").length,
  });
  if (!plan.roomChanged && !plan.datesChanged) throw new ActionError("No changes to save.");

  if (plan.datesChanged) {
    // Every open room of the reservation moves with the dates; the dragged one may also change room.
    const overrides = plan.roomChanged ? new Map([[line.id, plan.roomId!]]) : new Map<string, string>();
    await moveOpenLines(tx, before.bookings, plan.checkIn, plan.checkOut, overrides);
    await tx.reservation.update({ where: { id: before.id }, data: { checkIn: plan.checkIn, checkOut: plan.checkOut } });
  } else {
    await assertRoomAssignable(tx, { roomId: plan.roomId!, roomTypeId: line.roomTypeId, checkIn: line.checkIn, checkOut: line.checkOut, excludeBookingId: line.id });
    await tx.booking.update({ where: { id: line.id }, data: { roomId: plan.roomId } });
  }
  await syncTotal(tx, before.id);
  const after = await tx.reservation.findUniqueOrThrow({ where: { id: before.id }, select: { totalPriceNpr: true } });
  const result = outcome(after.totalPriceNpr);

  await logActivity(tx, {
    userId: actorId,
    action: "reservation.moved",
    entityType: "Reservation",
    entityId: before.id,
    details: {
      reference: before.reference,
      bookingId: line.id,
      ...(plan.roomChanged ? { room: { from: result.from.room, to: result.to.room } } : {}),
      ...(plan.datesChanged
        ? {
            checkIn: { from: result.from.checkIn, to: result.to.checkIn },
            checkOut: { from: result.from.checkOut, to: result.to.checkOut },
            totalPriceNpr: { from: result.from.totalNpr, to: result.to.totalNpr },
          }
        : {}),
    },
  });
  return result;
}

// ─── Blocks ──────────────────────────────────────────────────────────────────

export type BlockMoveInput = { blockId: string; roomId?: string; startDate?: string; endDate?: string };

export type BlockMoveOutcome = {
  room: string;
  from: { roomId: string; room: string; startDate: string; endDate: string };
  to: { room: string; startDate: string; endDate: string };
};

/** Moves or resizes a block, with the same checks as creating one: the room exists, is active, and nothing is booked there. */
export async function applyBlockMove(tx: Tx, actorId: string, input: BlockMoveInput): Promise<BlockMoveOutcome> {
  const block = await tx.roomBlock.findUnique({ where: { id: input.blockId }, include: { room: { select: { name: true } } } });
  if (!block) throw new ActionError("That block was already removed.");

  const roomId = input.roomId ?? block.roomId;
  const startDate = input.startDate ? parseDateOnly(input.startDate) : block.startDate;
  const endDate = input.endDate ? parseDateOnly(input.endDate) : block.endDate;
  if (!startDate || !endDate) throw new ActionError("Choose valid dates.");
  if (nightsBetween(startDate, endDate) < 1) throw new ActionError("The room must be available again after the first blocked night.");
  if (roomId === block.roomId && startDate.getTime() === block.startDate.getTime() && endDate.getTime() === block.endDate.getTime()) {
    throw new ActionError("No changes to save.");
  }

  // Rooms are locked in a fixed order, the same lock a confirm takes.
  for (const id of [...new Set([block.roomId, roomId])].sort()) await lockRoom(tx, id);
  const room = await tx.room.findUnique({ where: { id: roomId }, select: { name: true, isActive: true } });
  if (!room) throw new ActionError("That room no longer exists.");
  if (!room.isActive && roomId !== block.roomId) throw new ActionError(`${room.name} is archived. Choose another room.`);

  const clashes = await tx.booking.findMany({
    where: { roomId, status: { in: [...OCCUPYING_STATUSES] }, checkIn: { lt: endDate }, checkOut: { gt: startDate } },
    select: { reservation: { select: { reference: true } } },
  });
  if (clashes.length > 0) {
    throw new ActionError(`${room.name} has ${clashes.length === 1 ? "a booking" : "bookings"} on these dates (${clashes.map((c) => c.reservation.reference).join(", ")}).`);
  }

  await tx.roomBlock.update({ where: { id: block.id }, data: { roomId, startDate, endDate } });
  const outcome: BlockMoveOutcome = {
    room: room.name,
    from: { roomId: block.roomId, room: block.room.name, startDate: toDateOnlyString(block.startDate), endDate: toDateOnlyString(block.endDate) },
    to: { room: room.name, startDate: toDateOnlyString(startDate), endDate: toDateOnlyString(endDate) },
  };
  await logActivity(tx, {
    userId: actorId,
    action: "roomBlock.moved",
    entityType: "RoomBlock",
    entityId: block.id,
    details: { reason: block.reason, from: outcome.from, to: outcome.to },
  });
  return outcome;
}
