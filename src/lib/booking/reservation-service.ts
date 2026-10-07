import type { Prisma } from "@/generated/prisma/client";
import type { BookingStatus } from "@/generated/prisma/enums";
import { ActionError } from "@/lib/actions";
import { assertRoomAssignable, findFreeRooms } from "./availability";
import { BOOKING_STATUS_LABELS } from "./labels";
import { canTransition } from "./status";

type Tx = Prisma.TransactionClient;

/**
 * Changes to an existing reservation, each meant to run inside one transaction. Everything that decides rooms
 * (confirm, cancel, confirm all) lives here so the admin actions and the database tests use the same code.
 */

/** Serialises changes to one reservation (two people confirming and cancelling at once). Held until the transaction ends. */
export async function lockReservation(tx: Tx, reservationId: string) {
  await tx.$queryRaw`SELECT id FROM reservations WHERE id = ${reservationId} FOR UPDATE`;
}

/** The reservation's total is the sum of its rooms that haven't been cancelled (unchanged if all were). */
export async function syncTotal(tx: Tx, reservationId: string) {
  const lines = await tx.booking.findMany({ where: { reservationId }, select: { status: true, totalPriceNpr: true } });
  const kept = lines.filter((l) => l.status !== "CANCELLED");
  if (kept.length === 0) return;
  await tx.reservation.update({ where: { id: reservationId }, data: { totalPriceNpr: kept.reduce((n, l) => n + l.totalPriceNpr, 0) } });
}

export type Line = Prisma.BookingGetPayload<{ include: { reservation: { select: { reference: true } } } }>;

/**
 * Moves one room line to the next status, with its reservation locked. The status is part of the update's WHERE
 * clause, so two people acting at once can't both succeed. `prepare` runs first, inside the transaction, and may
 * refuse (throw) or return extra fields to save (a room, a reason, a timestamp).
 */
export async function transitionLine(
  tx: Tx,
  bookingId: string,
  to: BookingStatus,
  prepare?: (line: Line) => Promise<Prisma.BookingUncheckedUpdateManyInput>,
): Promise<Line> {
  const peek = await tx.booking.findUnique({ where: { id: bookingId }, select: { reservationId: true } });
  if (!peek) throw new ActionError("That room no longer exists.");
  await lockReservation(tx, peek.reservationId);
  const line = await tx.booking.findUnique({ where: { id: bookingId }, include: { reservation: { select: { reference: true } } } });
  if (!line) throw new ActionError("That room no longer exists.");
  if (!canTransition(line.status, to)) {
    throw new ActionError(
      `This room is ${BOOKING_STATUS_LABELS[line.status].toLowerCase()}, so it can't be moved to ${BOOKING_STATUS_LABELS[to].toLowerCase()}. Reload the page.`,
    );
  }
  const data = (await prepare?.(line)) ?? {};
  const updated = await tx.booking.updateMany({ where: { id: bookingId, status: line.status }, data: { ...data, status: to } });
  if (updated.count !== 1) throw new ActionError("Someone else just changed this room. Reload the page and try again.");
  await syncTotal(tx, line.reservationId);
  return line;
}

/** Confirms one pending room into a specific physical room (checked again with the room locked). */
export function confirmLineInRoom(tx: Tx, bookingId: string, roomId: string) {
  return transitionLine(tx, bookingId, "CONFIRMED", async (line) => {
    await assertRoomAssignable(tx, { roomId, roomTypeId: line.roomTypeId, checkIn: line.checkIn, checkOut: line.checkOut, excludeBookingId: line.id });
    return { roomId, confirmedAt: new Date() };
  });
}

/** Cancels one room with a reason. */
export function cancelLineWithReason(tx: Tx, bookingId: string, reason: string) {
  return transitionLine(tx, bookingId, "CANCELLED", async () => ({ cancelledAt: new Date(), cancellationReason: reason }));
}

/**
 * Confirms every pending room, giving each a free room of its type. All or nothing: if any type has fewer free
 * rooms than pending lines, throws (naming the type) and nothing changes.
 */
export async function confirmAllPending(tx: Tx, reservationId: string): Promise<{ reference: string; confirmed: number }> {
  await lockReservation(tx, reservationId);
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    include: {
      bookings: { where: { status: "PENDING" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { roomType: { select: { name: true } } } },
    },
  });
  if (!reservation) throw new ActionError("That booking no longer exists.");
  const pending = reservation.bookings;
  if (pending.length === 0) throw new ActionError("No rooms are waiting for confirmation.");

  // One free room per pending line, distinct within a type.
  const assignments: { line: (typeof pending)[number]; roomId: string }[] = [];
  for (const typeId of new Set(pending.map((l) => l.roomTypeId))) {
    const lines = pending.filter((l) => l.roomTypeId === typeId);
    const free = await findFreeRooms(tx, typeId, reservation.checkIn, reservation.checkOut);
    if (free.length < lines.length) {
      throw new ActionError(
        `Not enough ${lines[0].roomType.name} rooms are free for these dates: ${lines.length} needed, ${free.length} free. Nothing was confirmed. Confirm the rooms one by one, or change the dates.`,
      );
    }
    lines.forEach((line, i) => assignments.push({ line, roomId: free[i].id }));
  }

  // Check and write in a fixed room order (the same order every writer locks in).
  for (const { line, roomId } of [...assignments].sort((a, b) => a.roomId.localeCompare(b.roomId))) {
    await assertRoomAssignable(tx, { roomId, roomTypeId: line.roomTypeId, checkIn: line.checkIn, checkOut: line.checkOut, excludeBookingId: line.id });
    const updated = await tx.booking.updateMany({ where: { id: line.id, status: "PENDING" }, data: { status: "CONFIRMED", roomId, confirmedAt: new Date() } });
    if (updated.count !== 1) throw new ActionError("Someone else just changed this booking. Reload the page and try again.");
  }
  await syncTotal(tx, reservationId);
  return { reference: reservation.reference, confirmed: assignments.length };
}

/** Cancels every room that can still be cancelled (pending or confirmed) with one reason. */
export async function cancelOpenLines(tx: Tx, reservationId: string, reason: string): Promise<{ reference: string; cancelled: number }> {
  await lockReservation(tx, reservationId);
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    include: { bookings: { where: { status: { in: ["PENDING", "CONFIRMED"] } }, select: { id: true } } },
  });
  if (!reservation) throw new ActionError("That booking no longer exists.");
  if (reservation.bookings.length === 0) throw new ActionError("No rooms can be cancelled any more.");
  const updated = await tx.booking.updateMany({
    where: { id: { in: reservation.bookings.map((b) => b.id) }, status: { in: ["PENDING", "CONFIRMED"] } },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: reason },
  });
  await syncTotal(tx, reservationId);
  return { reference: reservation.reference, cancelled: updated.count };
}
