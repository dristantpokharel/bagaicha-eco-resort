import { BOOKING } from "@/config/booking";
import { addDays, nightsBetween, rangesOverlap, toDateOnlyString } from "./dates";
import type { Capacity, Party } from "./capacity";
import { canSeatFromFree, suggestCombination, type FreeType, type RoomLine, type ReservationQuote } from "./multi-room";

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

/** Types with the rooms free for the whole stay (types with none are left out). */
export function freeForStay(index: AvailabilityIndex, types: RoomTypeInfo[], checkIn: Date, checkOut: Date): FreeType<RoomTypeInfo>[] {
  return types.flatMap((type) => {
    const free = freeRoomCount(index, type.id, checkIn, checkOut);
    return free > 0 ? [{ type, free }] : [];
  });
}

/** True when some combination of rooms free for the whole stay, within the room limit, holds the party. */
export function partyCanStay(
  index: AvailabilityIndex,
  types: RoomTypeInfo[],
  party: Party,
  checkIn: Date,
  checkOut: Date,
  options: { onlyTypeId?: string | null; maxRooms?: number } = {},
): boolean {
  const free = freeForStay(index, options.onlyTypeId ? types.filter((t) => t.id === options.onlyTypeId) : types, checkIn, checkOut);
  return canSeatFromFree(party, free, options.maxRooms ?? BOOKING.maxRoomsPerRequest);
}

export type UnavailableReason =
  | { kind: "sold-out"; soldOutNights: number; nights: number }
  | { kind: "no-single-room" };

/**
 * Why a type can't take [checkIn, checkOut): some nights have no free room at all ("sold-out"), or every
 * night has a free room but no single room covers the whole stay ("no-single-room"). Null when it can.
 */
export function unavailableReason(index: AvailabilityIndex, roomTypeId: string, checkIn: Date, checkOut: Date): UnavailableReason | null {
  if (typeIsBookable(index, roomTypeId, checkIn, checkOut)) return null;
  const nights = nightsBetween(checkIn, checkOut);
  const soldOut = soldOutNights(index, roomTypeId, checkIn, nights).length;
  return soldOut > 0 ? { kind: "sold-out", soldOutNights: soldOut, nights } : { kind: "no-single-room" };
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
 * Nights the calendar treats as sold out for this party: a night is available when some combination of the
 * rooms free that night, within the online room limit, can hold the whole party. A chosen type (slug) counts
 * only its own rooms; "Any room" (null) counts every type. If the party couldn't be seated even with every
 * room free, nothing is shaded (the page explains that instead).
 */
export function soldOutForSelection(payload: AvailabilityPayload, slug: string | null, party: Party): Set<string> {
  const types = slug ? payload.types.filter((t) => t.slug === slug) : payload.types;
  const max = BOOKING.maxRoomsPerRequest;
  if (types.length === 0) return new Set();
  const everyRoomFree = types.map((type) => ({ type, free: type.rooms }));
  if (!canSeatFromFree(party, everyRoomFree, max)) return new Set();

  const from = new Date(`${payload.from}T00:00:00.000Z`);
  const verdicts = new Map<string, boolean>(); // free-room pattern → can the party be seated
  const soldOut = new Set<string>();
  for (let i = 0; i < payload.days; i++) {
    const counts = types.map((t) => Number(t.free[i] ?? "0"));
    const key = counts.join(",");
    let ok = verdicts.get(key);
    if (ok === undefined) {
      ok = canSeatFromFree(party, types.map((type, k) => ({ type, free: counts[k] })), max);
      verdicts.set(key, ok);
    }
    if (!ok) soldOut.add(toDateOnlyString(addDays(from, i)));
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

// ─── Alternatives ────────────────────────────────────────────────────────────

export type DateRangeSuggestion = { checkIn: Date; checkOut: Date };
export type CombinationSuggestion = { lines: RoomLine[]; quote: ReservationQuote };

/**
 * Next ranges of `nights` nights for which `canStay` holds, starting after `after` and no later than
 * `withinDays` days after it. Suggestions don't overlap each other, so the chips are genuinely different.
 */
export function nextAvailableRanges(
  canStay: (checkIn: Date, checkOut: Date) => boolean,
  params: { after: Date; nights: number; withinDays: number; max: number; horizon: Date },
): DateRangeSuggestion[] {
  const found: DateRangeSuggestion[] = [];
  let earliest = addDays(params.after, 1);
  for (let i = 1; i <= params.withinDays && found.length < params.max; i++) {
    const checkIn = addDays(params.after, i);
    const checkOut = addDays(checkIn, params.nights);
    if (checkOut > params.horizon) break;
    if (checkIn < earliest) continue;
    if (canStay(checkIn, checkOut)) {
      found.push({ checkIn, checkOut });
      earliest = checkOut;
    }
  }
  return found;
}

/**
 * What to offer when the party can't be seated for the chosen dates (or the chosen type).
 * - combination: rooms that hold the whole party for the same dates (fewest rooms, then cheapest), if any.
 * - dateRanges: the next same-length ranges where the party can stay (in the chosen type only, when one was chosen).
 */
export function suggestAlternatives(input: {
  index: AvailabilityIndex;
  types: RoomTypeInfo[];
  chosenTypeId: string | null;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  today: Date;
  withinDays: number;
  maxRanges: number;
  maxDaysAhead: number;
}): { combination: CombinationSuggestion | null; dateRanges: DateRangeSuggestion[] } {
  const { index, types, chosenTypeId, checkIn, checkOut } = input;
  const party = { adults: input.adults, children: input.children };
  const nights = nightsBetween(checkIn, checkOut);

  const combination = suggestCombination(party, freeForStay(index, types, checkIn, checkOut), nights);

  // The last bookable check-out: check-in is limited to maxDaysAhead and a stay can't run past it.
  const horizon = addDays(input.today, input.maxDaysAhead);
  const dateRanges = nextAvailableRanges(
    (from, to) => partyCanStay(index, types, party, from, to, { onlyTypeId: chosenTypeId }),
    {
      after: checkIn < input.today ? input.today : checkIn,
      nights,
      withinDays: input.withinDays,
      max: input.maxRanges,
      horizon,
    },
  );
  return { combination, dateRanges };
}
