import { BOOKING } from "@/config/booking";
import { addDays, rangesOverlap, toDateOnlyString } from "./dates";
import type { Capacity } from "./capacity";

/**
 * Pure availability rules, shared by the public calendar endpoint, /book's
 * alternatives and the tests. No database access: callers load rooms and the
 * occupied intervals (CONFIRMED/CHECKED_IN bookings and blocks; never PENDING).
 * Mirrors freeRoomWhere() in availability.ts, which stays authoritative on submit.
 * Stays are [checkIn, checkOut): the check-out day is not a night of the stay.
 */

export type AvailabilityRoom = { id: string; roomTypeId: string };
/** One occupied interval of one room, [start, end). */
export type Occupancy = { roomId: string; start: Date; end: Date };

export type AvailabilityIndex = {
  roomsByType: Map<string, string[]>;
  busyByRoom: Map<string, Occupancy[]>;
};

/** `rooms` must be active rooms only. */
export function buildIndex(rooms: AvailabilityRoom[], busy: Occupancy[]): AvailabilityIndex {
  const roomsByType = new Map<string, string[]>();
  for (const room of rooms) roomsByType.set(room.roomTypeId, [...(roomsByType.get(room.roomTypeId) ?? []), room.id]);
  const busyByRoom = new Map<string, Occupancy[]>();
  for (const item of busy) busyByRoom.set(item.roomId, [...(busyByRoom.get(item.roomId) ?? []), item]);
  return { roomsByType, busyByRoom };
}

function roomIsFree(index: AvailabilityIndex, roomId: string, checkIn: Date, checkOut: Date) {
  return !(index.busyByRoom.get(roomId) ?? []).some((b) => rangesOverlap(b.start, b.end, checkIn, checkOut));
}

/** Rooms of the type that are free for every night of [checkIn, checkOut): N here means N distinct rooms. */
export function freeRoomCount(index: AvailabilityIndex, roomTypeId: string, checkIn: Date, checkOut: Date): number {
  return (index.roomsByType.get(roomTypeId) ?? []).filter((roomId) => roomIsFree(index, roomId, checkIn, checkOut)).length;
}

/**
 * Continuity rule: a type can take [checkIn, checkOut) only when ONE room is
 * free for every night. Rooms that are free on different nights don't add up.
 */
export function typeIsBookable(index: AvailabilityIndex, roomTypeId: string, checkIn: Date, checkOut: Date): boolean {
  return freeRoomCount(index, roomTypeId, checkIn, checkOut) > 0;
}

/** Free rooms of the type on each of `days` nights from `from`. */
export function freeCountsByNight(index: AvailabilityIndex, roomTypeId: string, from: Date, days: number): number[] {
  return Array.from({ length: days }, (_, i) => freeRoomCount(index, roomTypeId, addDays(from, i), addDays(from, i + 1)));
}

/** Nights (ISO dates) from `from` for `days` days on which no active room of the type is free. */
export function soldOutNights(index: AvailabilityIndex, roomTypeId: string, from: Date, days: number): string[] {
  return freeCountsByNight(index, roomTypeId, from, days).flatMap((n, i) => (n === 0 ? [toDateOnlyString(addDays(from, i))] : []));
}

// ─── Public payload ──────────────────────────────────────────────────────────

export type AvailabilityPayload = {
  /** First night covered (ISO date) and how many nights. */
  from: string;
  days: number;
  /**
   * Per room type: how many rooms exist, and free rooms per night as one digit per night (capped at the online
   * room limit, so "4" means 4 or more). No room names or booking details.
   */
  types: ({ slug: string; name: string; rooms: number; free: string } & Capacity)[];
};

export type RoomTypeInfo = Capacity & {
  id: string;
  slug: string;
  name: string;
  basePriceNpr: number;
  childPricePerNightNpr: number;
};

export function buildAvailabilityPayload(
  types: RoomTypeInfo[],
  index: AvailabilityIndex,
  from: Date,
  days: number,
): AvailabilityPayload {
  return {
    from: toDateOnlyString(from),
    days,
    types: types.map((t) => ({
      slug: t.slug,
      name: t.name,
      maxGuests: t.maxGuests,
      maxAdults: t.maxAdults,
      maxChildren: t.maxChildren,
      rooms: index.roomsByType.get(t.id)?.length ?? 0,
      free: freeCountsByNight(index, t.id, from, days)
        .map((n) => Math.min(n, BOOKING.maxRoomsPerRequest))
        .join(""),
    })),
  };
}

// ─── Calendar rules (used by the browser) ────────────────────────────────────

/**
 * Nights the calendar treats as sold out for the rooms chosen so far (type slugs; rows with no type yet are left out).
 * With types chosen, a night is sold out when they can't all be seated in distinct free rooms: some type has fewer
 * free rooms that night than rooms chosen of it. With none chosen, only nights where no room of any type is free.
 * Guests don't shade anything: a type that can't hold a room's guests is disabled on its button instead.
 */
export function soldOutForRooms(payload: AvailabilityPayload, chosen: string[]): Set<string> {
  const wanted = new Map<string, number>();
  for (const slug of chosen) if (payload.types.some((t) => t.slug === slug)) wanted.set(slug, (wanted.get(slug) ?? 0) + 1);
  const from = new Date(`${payload.from}T00:00:00.000Z`);
  const soldOut = new Set<string>();
  for (let i = 0; i < payload.days; i++) {
    const freeOf = (slug: string) => Number(payload.types.find((t) => t.slug === slug)?.free[i] ?? "0");
    const blocked =
      wanted.size > 0
        ? [...wanted].some(([slug, n]) => freeOf(slug) < n)
        : payload.types.every((t) => Number(t.free[i] ?? "0") === 0);
    if (blocked) soldOut.add(toDateOnlyString(addDays(from, i)));
  }
  return soldOut;
}

/**
 * Latest check-out for a stay starting at `checkIn`: the first sold-out night
 * on or after check-in (check-out may land ON it, the range can't span it),
 * the night limit, and the booking horizon.
 */
export function latestCheckOut(soldOut: Set<string>, checkIn: Date, maxNights: number, horizon: Date): Date {
  let limit = addDays(checkIn, maxNights);
  if (horizon < limit) limit = horizon;
  for (let d = checkIn; d < limit; d = addDays(d, 1)) {
    if (soldOut.has(toDateOnlyString(d))) return d;
  }
  return limit;
}
