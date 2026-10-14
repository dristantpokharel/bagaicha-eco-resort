import { Prisma } from "@/generated/prisma/client";
import type { db } from "@/lib/db";
import { todayInResort } from "@/lib/dates";
import { toBoardRoom, type BoardRoom, type BoardStay } from "./board";

type Client = typeof db;

/** Every active room with its status and today's arrival and departure (Asia/Kathmandu). */
export async function loadBoard(client: Client, now = new Date()): Promise<BoardRoom[]> {
  const today = todayInResort(now);
  const rooms = await client.room.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      status: true,
      statusNote: true,
      dirtyCycle: true,
      inspectBookingId: true,
      roomType: { select: { name: true } },
      blocks: { where: { startDate: { lte: today }, endDate: { gt: today } }, select: { id: true }, take: 1 },
    },
  });
  const roomIds = rooms.map((r) => r.id);

  const [arrivals, departures, preps] = await Promise.all([
    client.booking.findMany({
      where: { roomId: { in: roomIds }, status: { in: ["CONFIRMED", "CHECKED_IN"] }, checkIn: today },
      select: { id: true, roomId: true, reservation: { select: { reference: true, guestName: true } } },
    }),
    client.booking.findMany({
      where: { roomId: { in: roomIds }, status: { in: ["CHECKED_IN", "CHECKED_OUT"] }, checkOut: today },
      select: { id: true, roomId: true, reservation: { select: { reference: true, guestName: true } } },
    }),
    client.roomTask.findMany({
      where: { roomId: { in: roomIds }, kind: "PREP", shortfalls: { not: Prisma.DbNull } },
      select: { roomId: true, cycle: true },
    }),
  ]);

  const stay = (b: { id: string; reservation: { reference: string; guestName: string } }): BoardStay => ({
    bookingId: b.id,
    reference: b.reservation.reference,
    guestName: b.reservation.guestName,
  });
  const byRoom = (rows: typeof arrivals) => new Map(rows.map((b) => [b.roomId, stay(b)]));
  const arrivalByRoom = byRoom(arrivals);
  const departureByRoom = byRoom(departures);
  const shortCycles = new Set(preps.map((p) => `${p.roomId}:${p.cycle}`));

  return rooms.map((room) =>
    toBoardRoom(
      { id: room.id, name: room.name, roomTypeName: room.roomType.name, status: room.status, statusNote: room.statusNote, inspectBookingId: room.inspectBookingId },
      {
        arrivalToday: arrivalByRoom.get(room.id) ?? null,
        departureToday: departureByRoom.get(room.id) ?? null,
        preppedShort: shortCycles.has(`${room.id}:${room.dirtyCycle}`),
        blockedToday: room.blocks.length > 0,
      },
    ),
  );
}
