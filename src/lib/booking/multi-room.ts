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

/** "2× Deluxe Room, 1× Family Room" in the order the types first appear. */
export function summariseRooms(names: string[]): string {
  const counts = new Map<string, number>();
  for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts].map(([name, n]) => `${n}× ${name}`).join(", ");
}
