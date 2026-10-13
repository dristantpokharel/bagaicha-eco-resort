import type { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { Role, BookingStatus } from "@/generated/prisma/enums";
import { can } from "@/lib/auth/permissions";
import { findFreeRooms, OCCUPYING_STATUSES } from "@/lib/booking/availability";
import { addDays, nightsBetween, toDateOnlyString } from "@/lib/booking/dates";
import { todayInResort } from "@/lib/dates";

export const PENDING_SHOWN = 10;
export const NEXT_DAYS = 7;

export type TodayLine = {
  id: string;
  status: BookingStatus;
  roomTypeName: string;
  roomName: string | null;
  guests: number;
};

export type TodayReservation = {
  id: string;
  reference: string;
  guestName: string;
  guestPhone: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  lines: TodayLine[];
  /** Pending requests only: how long it has waited, e.g. "3 hours". */
  waiting?: string;
};

export type NextDay = { date: string; arriving: number; departing: number };
export type FreeRoom = { id: string; name: string };

export type TodayData = {
  /** Today in Asia/Kathmandu, yyyy-MM-dd. */
  date: string;
  occupiedTonight: number;
  totalRooms: number;
  /** Reservations arriving today with a room still to check in or confirm (done rooms are shown but not counted). */
  arrivals: TodayReservation[];
  departures: TodayReservation[];
  /** Checked in and staying beyond today. */
  inHouse: TodayReservation[];
  pending: { items: TodayReservation[]; total: number };
  nextDays: NextDay[];
  /** For each unassigned arriving room: free rooms of its type for the whole stay. */
  freeRooms: Record<string, FreeRoom[]>;
};

/** "under an hour", "3 hours", "2 days": how long a request has been waiting. */
export function waitingLabel(since: Date, now: Date): string {
  const hours = Math.floor((now.getTime() - since.getTime()) / 3_600_000);
  if (hours < 1) return "under an hour";
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${Math.floor(hours / 24)} days`;
}

/** Rooms arriving and leaving on each of the days after `today` (confirmed and checked-in rooms only). */
export function buildNextDays(
  today: Date,
  lines: readonly { status: BookingStatus; checkIn: Date; checkOut: Date }[],
  days = NEXT_DAYS,
): NextDay[] {
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i + 1);
    const t = day.getTime();
    return {
      date: toDateOnlyString(day),
      arriving: lines.filter((l) => l.status === "CONFIRMED" && l.checkIn.getTime() === t).length,
      departing: lines.filter((l) => (l.status === "CONFIRMED" || l.status === "CHECKED_IN") && l.checkOut.getTime() === t).length,
    };
  });
}

const reservationSelect = {
  id: true,
  reference: true,
  guestName: true,
  guestPhone: true,
  checkIn: true,
  checkOut: true,
  createdAt: true,
  bookings: {
    select: {
      id: true,
      status: true,
      adults: true,
      children: true,
      roomTypeId: true,
      roomType: { select: { name: true } },
      room: { select: { name: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.ReservationSelect;

type Row = Prisma.ReservationGetPayload<{ select: typeof reservationSelect }>;

function toReservation(r: Row, statuses: readonly BookingStatus[], now: Date, withWaiting = false): TodayReservation {
  return {
    id: r.id,
    reference: r.reference,
    guestName: r.guestName,
    guestPhone: r.guestPhone,
    checkIn: toDateOnlyString(r.checkIn),
    checkOut: toDateOnlyString(r.checkOut),
    nights: nightsBetween(r.checkIn, r.checkOut),
    lines: r.bookings
      .filter((b) => statuses.includes(b.status))
      .map((b) => ({
        id: b.id,
        status: b.status,
        roomTypeName: b.roomType.name,
        roomName: b.room?.name ?? null,
        guests: b.adults + b.children,
      })),
    ...(withWaiting ? { waiting: waitingLabel(r.createdAt, now) } : {}),
  };
}

const EMPTY = (date: string): TodayData => ({
  date,
  occupiedTonight: 0,
  totalRooms: 0,
  arrivals: [],
  departures: [],
  inHouse: [],
  pending: { items: [], total: 0 },
  nextDays: [],
  freeRooms: {},
});

/**
 * Everything the Today screen shows about bookings, in Asia/Kathmandu time. Reservations, not rooms:
 * a booking of three rooms is one arrival and one request. Roles without booking access get nothing.
 */
export async function loadToday(client: typeof db, role: Role, now = new Date()): Promise<TodayData> {
  const today = todayInResort(now);
  const date = toDateOnlyString(today);
  if (!can(role, "bookings.manage")) return EMPTY(date);

  const open = (...s: BookingStatus[]) => ({ some: { status: { in: s } } });
  const [totalRooms, occupiedLines, arrivals, departures, inHouse, pending, pendingTotal, nextLines] = await Promise.all([
    client.room.count({ where: { isActive: true } }),
    client.booking.findMany({
      where: { status: { in: [...OCCUPYING_STATUSES] }, roomId: { not: null }, room: { isActive: true }, checkIn: { lte: today }, checkOut: { gt: today } },
      select: { roomId: true },
    }),
    client.reservation.findMany({
      where: { checkIn: today, bookings: open("PENDING", "CONFIRMED", "CHECKED_IN") },
      select: reservationSelect,
      orderBy: { createdAt: "asc" },
    }),
    client.reservation.findMany({
      where: { checkOut: today, bookings: open("CHECKED_IN", "CHECKED_OUT") },
      select: reservationSelect,
      orderBy: { createdAt: "asc" },
    }),
    client.reservation.findMany({
      where: { checkOut: { gt: today }, bookings: open("CHECKED_IN") },
      select: reservationSelect,
      orderBy: [{ checkOut: "asc" }, { createdAt: "asc" }],
    }),
    client.reservation.findMany({
      where: { bookings: open("PENDING") },
      select: reservationSelect,
      orderBy: { createdAt: "asc" },
      take: PENDING_SHOWN,
    }),
    client.reservation.count({ where: { bookings: open("PENDING") } }),
    client.booking.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
        OR: [
          { checkIn: { gt: today, lte: addDays(today, NEXT_DAYS) } },
          { checkOut: { gt: today, lte: addDays(today, NEXT_DAYS) } },
        ],
      },
      select: { status: true, checkIn: true, checkOut: true },
    }),
  ]);

  const arrivalList = arrivals.map((r) => toReservation(r, ["PENDING", "CONFIRMED", "CHECKED_IN"], now));

  // Free rooms for the unassigned arrivals, one lookup per room type and stay.
  const freeRooms: Record<string, FreeRoom[]> = {};
  const cache = new Map<string, Promise<FreeRoom[]>>();
  await Promise.all(
    arrivals.flatMap((r) =>
      r.bookings
        .filter((b) => b.status === "PENDING")
        .map(async (b) => {
          const key = `${b.roomTypeId}|${r.checkIn.getTime()}|${r.checkOut.getTime()}`;
          if (!cache.has(key)) cache.set(key, findFreeRooms(client, b.roomTypeId, r.checkIn, r.checkOut));
          freeRooms[b.id] = await cache.get(key)!;
        }),
    ),
  );

  return {
    date,
    occupiedTonight: new Set(occupiedLines.map((l) => l.roomId)).size,
    totalRooms,
    arrivals: arrivalList,
    departures: departures.map((r) => toReservation(r, ["CHECKED_IN", "CHECKED_OUT"], now)),
    inHouse: inHouse.map((r) => toReservation(r, ["CHECKED_IN"], now)),
    pending: { items: pending.map((r) => toReservation(r, ["PENDING"], now, true)), total: pendingTotal },
    nextDays: buildNextDays(today, nextLines),
    freeRooms,
  };
}
