import { BOOKING } from "@/config/booking";
import { partyProblem, type Capacity, type Party } from "./capacity";
import { computeQuote, type Quote } from "./pricing";

/**
 * Pure rules for a request that spans several rooms for the same dates.
 * Every per-room check goes through the shared capacity rule (capacity.ts).
 */

export type RoomTypeForBooking = Capacity & {
  id: string;
  name: string;
  basePriceNpr: number;
  childPricePerNightNpr: number;
};

/** One requested room: its type and the guests staying in it. */
export type RoomLine = { roomTypeId: string; adults: number; children: number };

type Slot = Party & { index: number };

// ─── Exact seating (small search, memoised) ──────────────────────────────────

/** Every (adults, children) a room of this type can hold, at least one adult. */
function roomOptions(cap: Capacity): Party[] {
  const out: Party[] = [];
  for (let a = 1; a <= Math.min(cap.maxAdults, cap.maxGuests); a++) {
    const maxC = Math.min(cap.maxChildren ?? cap.maxGuests, cap.maxGuests - a);
    for (let c = 0; c <= maxC; c++) out.push({ adults: a, children: c });
  }
  return out;
}

/** Finds any split of the party over rooms with these limits, every room holding an adult. Null if none. */
function findSplit(caps: Capacity[], party: Party): Party[] | null {
  const options = caps.map(roomOptions);
  const failed = new Set<string>();
  const place = (i: number, a: number, c: number): Party[] | null => {
    if (i === caps.length) return a === 0 && c === 0 ? [] : null;
    const key = `${i}:${a}:${c}`;
    if (failed.has(key)) return null;
    // Try the most even share first, so the split reads naturally.
    const rooms = caps.length - i;
    const distance = (o: Party) => Math.abs(o.adults - a / rooms) + Math.abs(o.children - c / rooms);
    const sorted = [...options[i]].sort((x, y) => distance(x) - distance(y));
    for (const o of sorted) {
      if (o.adults > a || o.children > c) continue;
      const rest = place(i + 1, a - o.adults, c - o.children);
      if (rest) return [o, ...rest];
    }
    failed.add(key);
    return null;
  };
  return place(0, party.adults, party.children);
}

/** True when this set of rooms can take the whole party between them. */
export function canSeat(caps: Capacity[], party: Party): boolean {
  if (caps.length === 0 || party.adults < caps.length) return false;
  return findSplit(caps, party) !== null;
}

// ─── Auto-split ──────────────────────────────────────────────────────────────

/**
 * Splits the party across the selected rooms (one entry per room, in order).
 * Adults are spread first, then children, always into the room with the most space left.
 * If that can't seat everyone but another split can, the other split is used.
 * If nobody can be seated properly the best attempt is returned and validateSplit explains why.
 */
export function splitParty(party: Party, caps: Capacity[]): Party[] {
  if (caps.length === 0) return [];
  const slots: Slot[] = caps.map((_, index) => ({ index, adults: Math.min(1, party.adults), children: 0 }));
  const space = (s: Slot) => caps[s.index].maxGuests - s.adults - s.children;
  const richest = (ok: (s: Slot) => boolean) =>
    slots.filter(ok).sort((x, y) => space(y) - space(x) || x.index - y.index)[0];

  let adultsLeft = party.adults - slots.reduce((n, s) => n + s.adults, 0);
  while (adultsLeft > 0) {
    const slot = richest((s) => space(s) > 0 && s.adults < caps[s.index].maxAdults);
    if (!slot) break;
    slot.adults++;
    adultsLeft--;
  }
  let childrenLeft = party.children;
  while (childrenLeft > 0) {
    const slot = richest((s) => space(s) > 0 && (caps[s.index].maxChildren === null || s.children < caps[s.index].maxChildren!));
    if (!slot) break;
    slot.children++;
    childrenLeft--;
  }

  const greedy = slots.map(({ adults, children }) => ({ adults, children }));
  if (adultsLeft === 0 && childrenLeft === 0 && greedy.every((p, i) => partyProblem(caps[i], p) === null)) return greedy;
  return findSplit(caps, party) ?? greedy;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type SplitValidation = {
  ok: boolean;
  /** Messages for single rooms, keyed by the line's position. */
  lineErrors: Record<number, string>;
  /** Messages about the whole selection (room count, guests not placed). */
  errors: string[];
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Checks a selection against the party: 1 to maxRooms rooms, each fits its type, everyone placed exactly once. */
export function validateSplit(
  lines: RoomLine[],
  types: ReadonlyMap<string, RoomTypeForBooking>,
  party: Party,
  options: { maxRooms?: number | null } = {},
): SplitValidation {
  const maxRooms = options.maxRooms === undefined ? BOOKING.maxRoomsPerRequest : options.maxRooms;
  const lineErrors: Record<number, string> = {};
  const errors: string[] = [];

  if (lines.length === 0) errors.push("Choose at least one room.");
  if (maxRooms !== null && lines.length > maxRooms) {
    errors.push(`You can request up to ${maxRooms} rooms online. For a larger group, please send an enquiry.`);
  }

  lines.forEach((line, i) => {
    const type = types.get(line.roomTypeId);
    const label = `Room ${i + 1}${type ? ` (${type.name})` : ""}`;
    if (!type) {
      lineErrors[i] = `${label}: that room type isn't available.`;
      return;
    }
    const problem = partyProblem(type, line);
    if (problem) lineErrors[i] = `${label}: ${problem.message}`;
  });

  const adults = lines.reduce((n, l) => n + l.adults, 0);
  const children = lines.reduce((n, l) => n + l.children, 0);
  if (adults < party.adults) errors.push(`${plural(party.adults - adults, "adult is", "adults are")} not placed in a room yet.`);
  if (adults > party.adults) errors.push(`${plural(adults - party.adults, "adult", "adults")} too many across the rooms. Your group has ${party.adults}.`);
  if (children < party.children) errors.push(`${plural(party.children - children, "child is", "children are")} not placed in a room yet.`);
  if (children > party.children) errors.push(`${plural(children - party.children, "child", "children")} too many across the rooms. Your group has ${party.children}.`);

  return { ok: errors.length === 0 && Object.keys(lineErrors).length === 0, lineErrors, errors };
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

export type ReservationQuote = { nights: number; lines: Quote[]; totalPriceNpr: number };

/** Per-room computeQuote lines and the grand total. Rates come from the database rows passed in. */
export function quoteReservation(
  lines: RoomLine[],
  types: ReadonlyMap<string, Pick<RoomTypeForBooking, "basePriceNpr" | "childPricePerNightNpr">>,
  nights: number,
): ReservationQuote {
  const quotes = lines.map((line) => {
    const type = types.get(line.roomTypeId);
    if (!type) throw new Error("Unknown room type in reservation quote.");
    return computeQuote({
      nights,
      pricePerNightNpr: type.basePriceNpr,
      childPricePerNightNpr: type.childPricePerNightNpr,
      children: line.children,
    });
  });
  return { nights, lines: quotes, totalPriceNpr: quotes.reduce((n, q) => n + q.totalPriceNpr, 0) };
}

// ─── Combinations ────────────────────────────────────────────────────────────

export type FreeType<T extends Capacity = RoomTypeForBooking> = { type: T; free: number };

/** Every way to pick up to maxRooms rooms, no more of a type than are free. */
function* selections<T extends Capacity>(types: FreeType<T>[], maxRooms: number): Generator<T[]> {
  const walk = function* (i: number, picked: T[]): Generator<T[]> {
    if (i === types.length) {
      if (picked.length > 0) yield picked;
      return;
    }
    const limit = Math.min(types[i].free, maxRooms - picked.length);
    for (let n = 0; n <= limit; n++) yield* walk(i + 1, [...picked, ...Array<T>(n).fill(types[i].type)]);
  };
  yield* walk(0, []);
}

/** True when some combination of the free rooms, within maxRooms, can hold the party. */
export function canSeatFromFree<T extends Capacity>(
  party: Party,
  free: FreeType<T>[],
  maxRooms: number = BOOKING.maxRoomsPerRequest,
): boolean {
  for (const rooms of selections(free, maxRooms)) if (canSeat(rooms, party)) return true;
  return false;
}

/**
 * A working combination for the party from the free rooms: fewest rooms first, then the lowest price,
 * then the order the types were given in. Null when nothing within maxRooms holds the party.
 */
export function suggestCombination(
  party: Party,
  free: FreeType[],
  nights: number,
  maxRooms: number = BOOKING.maxRoomsPerRequest,
): { lines: RoomLine[]; quote: ReservationQuote } | null {
  const byId = new Map(free.map((f) => [f.type.id, f.type]));
  let best: { lines: RoomLine[]; quote: ReservationQuote } | null = null;
  for (const rooms of selections(free, maxRooms)) {
    if (!canSeat(rooms, party)) continue;
    const split = splitParty(party, rooms);
    const lines = rooms.map((r, i) => ({ roomTypeId: r.id, ...split[i] }));
    const quote = quoteReservation(lines, byId, nights);
    const better =
      !best ||
      lines.length < best.lines.length ||
      (lines.length === best.lines.length && quote.totalPriceNpr < best.quote.totalPriceNpr);
    if (better) best = { lines, quote };
  }
  return best && { lines: best.lines, quote: best.quote };
}

/** "2× Deluxe Room, 1× Family Room" in the order the types first appear. */
export function summariseRooms(names: string[]): string {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts].map(([name, n]) => `${n}× ${name}`).join(", ");
}
