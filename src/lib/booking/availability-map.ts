import { addDays, nightsBetween, rangesOverlap, toDateOnlyString } from "./dates";
import { fittingTypes, type Capacity, type Party } from "./capacity";
import { computeQuote, type Quote } from "./pricing";

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

/**
 * Continuity rule: a type can take [checkIn, checkOut) only when ONE room is
 * free for every night. Rooms that are free on different nights don't add up.
 */
export function typeIsBookable(index: AvailabilityIndex, roomTypeId: string, checkIn: Date, checkOut: Date): boolean {
  return (index.roomsByType.get(roomTypeId) ?? []).some((roomId) => roomIsFree(index, roomId, checkIn, checkOut));
}

/** Nights (ISO dates) from `from` for `days` days on which no active room of the type is free. */
export function soldOutNights(index: AvailabilityIndex, roomTypeId: string, from: Date, days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    const night = addDays(from, i);
    if (!typeIsBookable(index, roomTypeId, night, addDays(night, 1))) out.push(toDateOnlyString(night));
  }
  return out;
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
  /** Per room type: sold-out nights only. No counts, room names or booking details. */
  types: ({ slug: string; name: string; soldOut: string[] } & Capacity)[];
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
      soldOut: soldOutNights(index, t.id, from, days),
    })),
  };
}

// ─── Calendar rules (used by the browser) ────────────────────────────────────

/**
 * Nights the calendar treats as sold out. A chosen type uses its own nights.
 * "Any room" (slug null): only types that take the party count, and a night is
 * sold out when every one of them is.
 */
export function soldOutForSelection(payload: AvailabilityPayload, slug: string | null, party: Party): Set<string> {
  if (slug) return new Set(payload.types.find((t) => t.slug === slug)?.soldOut ?? []);
  const fitting = fittingTypes(payload.types, party);
  if (fitting.length === 0) return new Set();
  const counts = new Map<string, number>();
  for (const t of fitting) for (const night of t.soldOut) counts.set(night, (counts.get(night) ?? 0) + 1);
  return new Set([...counts].filter(([, n]) => n === fitting.length).map(([night]) => night));
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
export type TypeSuggestion = { roomType: RoomTypeInfo; quote: Quote };

/**
 * Next ranges of `nights` nights where one of `roomTypeIds` can take the whole
 * stay, starting after `after` and no later than `withinDays` days after it.
 * Suggestions don't overlap each other, so the chips are genuinely different.
 */
export function nextAvailableRanges(
  index: AvailabilityIndex,
  roomTypeIds: string[],
  params: { after: Date; nights: number; withinDays: number; max: number; horizon: Date },
): DateRangeSuggestion[] {
  const found: DateRangeSuggestion[] = [];
  let earliest = addDays(params.after, 1);
  for (let i = 1; i <= params.withinDays && found.length < params.max; i++) {
    const checkIn = addDays(params.after, i);
    const checkOut = addDays(checkIn, params.nights);
    if (checkOut > params.horizon) break;
    if (checkIn < earliest) continue;
    if (roomTypeIds.some((id) => typeIsBookable(index, id, checkIn, checkOut))) {
      found.push({ checkIn, checkOut });
      earliest = checkOut;
    }
  }
  return found;
}

/**
 * What to offer when the chosen type (or any type) can't take the stay.
 * - otherTypes: other types that sleep the party and are bookable for the same dates, with totals.
 * - dateRanges: the next same-length ranges for the chosen type (any fitting type when none was chosen).
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
}): { otherTypes: TypeSuggestion[]; dateRanges: DateRangeSuggestion[] } {
  const { index, types, chosenTypeId, checkIn, checkOut, adults, children } = input;
  const nights = nightsBetween(checkIn, checkOut);
  const fitting = fittingTypes(types, { adults, children });

  const otherTypes = fitting
    .filter((t) => t.id !== chosenTypeId && typeIsBookable(index, t.id, checkIn, checkOut))
    .map((roomType) => ({
      roomType,
      quote: computeQuote({
        nights,
        pricePerNightNpr: roomType.basePriceNpr,
        childPricePerNightNpr: roomType.childPricePerNightNpr,
        children,
      }),
    }));

  const rangeTypeIds = chosenTypeId ? fitting.filter((t) => t.id === chosenTypeId).map((t) => t.id) : fitting.map((t) => t.id);
  // The last bookable check-out: check-in is limited to maxDaysAhead and a stay can't run past it.
  const horizon = addDays(input.today, input.maxDaysAhead);
  const dateRanges = nextAvailableRanges(index, rangeTypeIds, {
    after: checkIn < input.today ? input.today : checkIn,
    nights,
    withinDays: input.withinDays,
    max: input.maxRanges,
    horizon,
  });
  return { otherTypes, dateRanges };
}
