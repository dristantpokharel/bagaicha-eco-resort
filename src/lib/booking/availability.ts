import type { Prisma } from "@/generated/prisma/client";
import { ActionError } from "@/lib/actions";

type Client = Prisma.TransactionClient;

/** Statuses that occupy a physical room. PENDING requests hold nothing. */
export const OCCUPYING_STATUSES = ["CONFIRMED", "CHECKED_IN"] as const;

/**
 * A room is free for [checkIn, checkOut) when it is active and has no
 * overlapping CONFIRMED/CHECKED_IN booking and no overlapping block.
 * `excludeBookingId` lets a booking be edited without conflicting with itself.
 */
export function freeRoomWhere(checkIn: Date, checkOut: Date, excludeBookingId?: string) {
  return {
    isActive: true,
    bookings: {
      none: {
        status: { in: [...OCCUPYING_STATUSES] },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
    },
    blocks: { none: { startDate: { lt: checkOut }, endDate: { gt: checkIn } } },
  } satisfies Prisma.RoomWhereInput;
}

export function findFreeRooms(
  client: Client,
  roomTypeId: string,
  checkIn: Date,
  checkOut: Date,
  excludeBookingId?: string,
) {
  return client.room.findMany({
    where: { roomTypeId, ...freeRoomWhere(checkIn, checkOut, excludeBookingId) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Active room types with how many of their rooms are free for the WHOLE stay [checkIn, checkOut).
 * Each counted room has no overlapping stay or block on any night, so N here means N distinct rooms that can
 * all take the stay; rooms that are free on different nights are never added together.
 * Types with no free room are left out.
 */
export async function findFreeCounts(client: Client, checkIn: Date, checkOut: Date) {
  const types = await client.roomType.findMany({
    where: { isActive: true },
    include: { rooms: { where: freeRoomWhere(checkIn, checkOut), select: { id: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return types
    .filter((t) => t.rooms.length > 0)
    .map(({ rooms, ...type }) => ({ type, free: rooms.length }));
}

/**
 * Serialises changes to one physical room: confirm, edit, block and archive
 * all take this lock first, so a block and a confirm can't both pass their
 * checks at the same moment. Held until the transaction ends.
 */
export async function lockRoom(tx: Client, roomId: string) {
  await tx.$queryRaw`SELECT id FROM rooms WHERE id = ${roomId} FOR UPDATE`;
}

/**
 * Locks the room and re-checks everything that must hold to put a booking in
 * it: room exists, active, right type, no block, no overlapping stay.
 * The exclusion constraint remains the final backstop (see isRoomConflictError).
 */
export async function assertRoomAssignable(
  tx: Client,
  params: { roomId: string; roomTypeId: string; checkIn: Date; checkOut: Date; excludeBookingId?: string },
) {
  const { roomId, roomTypeId, checkIn, checkOut, excludeBookingId } = params;
  await lockRoom(tx, roomId);

  const room = await tx.room.findUnique({ where: { id: roomId }, select: { name: true, isActive: true, roomTypeId: true } });
  if (!room) throw new ActionError("That room no longer exists.");
  if (!room.isActive) throw new ActionError(`${room.name} is archived. Choose another room.`);
  if (room.roomTypeId !== roomTypeId) throw new ActionError(`${room.name} is not a room of this booking's type.`);

  const block = await tx.roomBlock.findFirst({
    where: { roomId, startDate: { lt: checkOut }, endDate: { gt: checkIn } },
    select: { reason: true },
  });
  if (block) throw new ActionError(`${room.name} is blocked for part of these dates (${block.reason}).`);

  const clash = await tx.booking.findFirst({
    where: {
      roomId,
      status: { in: [...OCCUPYING_STATUSES] },
      checkIn: { lt: checkOut },
      checkOut: { gt: checkIn },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { reservation: { select: { reference: true } } },
  });
  if (clash) throw new ActionError(`${room.name} is already booked for overlapping dates (${clash.reservation.reference}).`);

  return room;
}

/**
 * True when Postgres rejected a write because of the booking overlap
 * exclusion constraint (SQLSTATE 23P01). Walks the error and its causes,
 * since the driver adapter wraps the original error.
 */
export function isRoomConflictError(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 4) return false;
  const e = error as { code?: unknown; message?: unknown; cause?: unknown; meta?: unknown };
  if (e.code === "23P01") return true;
  if (typeof e.message === "string" && e.message.includes("bookings_room_no_overlap")) return true;
  if (e.meta && JSON.stringify(e.meta).includes("23P01")) return true;
  return isRoomConflictError(e.cause, depth + 1);
}

export const ROOM_CONFLICT_MESSAGE =
  "That room was just booked for overlapping dates. Choose another room or different dates.";
