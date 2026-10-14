import type { Prisma } from "@/generated/prisma/client";
import type { RoomStatus } from "@/generated/prisma/enums";
import { ActionError } from "@/lib/actions";
import { logActivity } from "@/lib/activity-log";
import { lockRoom } from "@/lib/booking/availability";
import { ROOM_STATUS_LABELS } from "./labels";
import { planManualChange } from "./status";

type Tx = Prisma.TransactionClient;

type Reason = "checkin" | "checkout" | "manual";

async function logStatus(
  tx: Tx,
  params: { userId: string | null; roomId: string; roomName: string; from: RoomStatus; to: RoomStatus; reason: Reason; note?: string | null; bookingId?: string },
) {
  await logActivity(tx, {
    userId: params.userId,
    action: "room.statusChanged",
    entityType: "Room",
    entityId: params.roomId,
    details: {
      room: params.roomName,
      from: params.from,
      to: params.to,
      reason: params.reason,
      ...(params.note ? { note: params.note } : {}),
      ...(params.bookingId ? { bookingId: params.bookingId } : {}),
    },
  });
}

/**
 * A guest checked in: the room is Occupied. Called inside the check-in transaction (reservation lock held,
 * then the room lock: the one lock order, reservation → room → items). Checking in never waits on the room's
 * state; the warning is the UI's job.
 */
export async function markRoomOccupied(tx: Tx, params: { roomId: string; bookingId: string; userId: string | null }) {
  await lockRoom(tx, params.roomId);
  const room = await tx.room.findUniqueOrThrow({ where: { id: params.roomId }, select: { name: true, status: true } });
  await tx.room.update({
    where: { id: params.roomId },
    data: { status: "OCCUPIED", statusNote: null, statusChangedAt: new Date(), inspectBookingId: null },
  });
  await logStatus(tx, { userId: params.userId, roomId: params.roomId, roomName: room.name, from: room.status, to: "OCCUPIED", reason: "checkin", bookingId: params.bookingId });
}

/** A guest checked out: the room is Dirty, a new dirty cycle starts, and the stay waits to be inspected. */
export async function markRoomDirtyAfterCheckout(tx: Tx, params: { roomId: string; bookingId: string; userId: string | null }) {
  await lockRoom(tx, params.roomId);
  const room = await tx.room.findUniqueOrThrow({ where: { id: params.roomId }, select: { name: true, status: true } });
  await tx.room.update({
    where: { id: params.roomId },
    data: { status: "DIRTY", statusNote: null, statusChangedAt: new Date(), dirtyCycle: { increment: 1 }, inspectBookingId: params.bookingId },
  });
  await logStatus(tx, { userId: params.userId, roomId: params.roomId, roomName: room.name, from: room.status, to: "DIRTY", reason: "checkout", bookingId: params.bookingId });
}

/** Staff change a room's status by hand (Dirty, Ready or Out of order). Logged. */
export async function setRoomStatus(tx: Tx, params: { roomId: string; to: RoomStatus; note: string | null; userId: string }) {
  await lockRoom(tx, params.roomId);
  const room = await tx.room.findUnique({ where: { id: params.roomId }, select: { name: true, status: true, isActive: true } });
  if (!room) throw new ActionError("That room no longer exists.");
  const guestInside = (await tx.booking.count({ where: { roomId: params.roomId, status: "CHECKED_IN" } })) > 0;
  const change = planManualChange({ from: room.status, to: params.to, note: params.note, guestInside });

  await tx.room.update({
    where: { id: params.roomId },
    data: {
      status: change.to,
      statusNote: change.note,
      statusChangedAt: new Date(),
      inspectBookingId: null,
      ...(change.bumpsCycle ? { dirtyCycle: { increment: 1 } } : {}),
    },
  });
  await logStatus(tx, { userId: params.userId, roomId: params.roomId, roomName: room.name, from: room.status, to: change.to, reason: "manual", note: change.note });
  return `${room.name} is now ${ROOM_STATUS_LABELS[change.to].toLowerCase()}.`;
}
