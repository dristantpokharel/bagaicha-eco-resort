import { BOOKING } from "@/config/booking";
import { partyFits, partyProblem, type Capacity, type Party } from "./capacity";
import { computeQuote, type Quote } from "./pricing";

/**
 * Pure rules for the "build your stay" form on /book: a list of rooms, each with a type (or none yet) and its guests.
 * Capacity always goes through the shared rule in capacity.ts; prices through computeQuote.
 */

export type BuilderType = Capacity & {
  slug: string;
  name: string;
  basePriceNpr: number;
  childPricePerNightNpr: number;
};

/** One row of the form. `slug` is null until a type is chosen. */
export type BuilderRoom = { slug: string | null; adults: number; children: number };

/** Rooms free for the whole stay by type slug; null while the dates aren't set (or the numbers haven't loaded). */
export type StayFree = ReadonlyMap<string, number> | null;

export const DEFAULT_PARTY: Party = { adults: 2, children: 0 };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ─── Type buttons ────────────────────────────────────────────────────────────

/** Short reason a party doesn't fit a type, for a disabled button ("Fits up to 3"). Null when it fits. */
export function fitReason(cap: Capacity, party: Party): string | null {
  if (partyFits(cap, party)) return null;
  if (party.adults > cap.maxAdults) return `Max ${plural(cap.maxAdults, "adult", "adults")}`;
  if (party.adults + party.children > cap.maxGuests) return `Fits up to ${cap.maxGuests}`;
  if (cap.maxChildren !== null && party.children > cap.maxChildren) return `Max ${plural(cap.maxChildren, "child", "children")}`;
  return null;
}

/** How many rooms of the type the other rows have taken. */
const takenByOthers = (rooms: BuilderRoom[], index: number, slug: string) =>
  rooms.reduce((n, r, i) => (i !== index && r.slug === slug ? n + 1 : n), 0);

export type TypeOption = {
  /** Rooms still free for this row ("2 left"): free for the stay minus what the other rows hold. Null before dates are set. */
  left: number | null;
  disabled: boolean;
  reason: string | null;
};

/** What the button for `type` shows in row `index`. A row's own choice never counts against itself. */
export function typeOption(rooms: BuilderRoom[], index: number, type: BuilderType, free: StayFree): TypeOption {
  const left = free ? Math.max(0, (free.get(type.slug) ?? 0) - takenByOthers(rooms, index, type.slug)) : null;
  if (free && (free.get(type.slug) ?? 0) === 0) return { left, disabled: true, reason: "Sold out" };
  if (left === 0) return { left, disabled: true, reason: "None left" };
  const reason = fitReason(type, rooms[index]);
  return { left, disabled: reason !== null, reason };
}

// ─── Guests ──────────────────────────────────────────────────────────────────

/** Which steppers can move for one room. `caps` is the chosen type's limits, or every type's while none is chosen. */
export function guestLimits(party: Party, caps: Capacity[]) {
  return {
    canAddAdult: caps.some((c) => partyFits(c, { ...party, adults: party.adults + 1 })),
    canRemoveAdult: party.adults > 1,
    canAddChild: caps.some((c) => partyFits(c, { ...party, children: party.children + 1 })),
    canRemoveChild: party.children > 0,
  };
}

/** Moves one count by `delta`, refusing any step past a limit (returns the party unchanged). */
export function stepGuests(party: Party, field: keyof Party, delta: 1 | -1, caps: Capacity[]): Party {
  const l = guestLimits(party, caps);
  const allowed = field === "adults" ? (delta > 0 ? l.canAddAdult : l.canRemoveAdult) : delta > 0 ? l.canAddChild : l.canRemoveChild;
  return allowed ? { ...party, [field]: party[field] + delta } : party;
}

/** A note for a disabled + button, so it never looks broken; null when both + buttons work. */
export function guestNote(party: Party, caps: Capacity[], typeName?: string): string | null {
  const { canAddAdult, canAddChild } = guestLimits(party, caps);
  if (canAddAdult && canAddChild) return null;
  if (caps.length !== 1) return "That's the most our largest room takes.";
  const [cap] = caps;
  const name = typeName ?? "This room";
  if (party.adults + party.children >= cap.maxGuests) return `${name} sleeps up to ${cap.maxGuests} guests, children included.`;
  if (!canAddAdult && !canAddChild) return `${name} can't take more of this group.`;
  if (!canAddAdult) return `${name} takes up to ${plural(cap.maxAdults, "adult", "adults")}.`;
  return `${name} takes up to ${plural(cap.maxChildren ?? 0, "child", "children")}.`;
}

/** "2 adults · 0 children" */
export const guestsSummary = ({ adults, children }: Party) => `${plural(adults, "adult", "adults")} · ${plural(children, "child", "children")}`;

/** "0–12" for a child age limit of 13 (children are younger than the limit). */
export const childAgeRange = (childUnderAge: number) => `0–${childUnderAge - 1}`;

/** Guests for Room 1 when it starts with a type already chosen (from /stay): 2 adults, fewer if the room is smaller. */
export function startingParty(type: Capacity): Party {
  const adults = Math.max(1, Math.min(DEFAULT_PARTY.adults, type.maxAdults, type.maxGuests));
  return { adults, children: 0 };
}

// ─── Validation and pricing ──────────────────────────────────────────────────

export type RoomsCheck = {
  ok: boolean;
  /** One message per room, null when the room is fine. */
  problems: (string | null)[];
  /** Something about the whole selection (too many rooms, nothing chosen yet). */
  general: string | null;
};

/**
 * Every room has a type that fits its guests, and no type is used more often than there are free rooms for the whole stay.
 * `free` null means the dates aren't ready, so nothing can be confirmed yet.
 */
export function checkRooms(rooms: BuilderRoom[], types: ReadonlyMap<string, BuilderType>, free: StayFree, maxRooms: number = BOOKING.maxRoomsPerRequest): RoomsCheck {
  const used = new Map<string, number>();
  const problems = rooms.map((room, i) => {
    const label = `Room ${i + 1}`;
    const type = room.slug ? types.get(room.slug) : undefined;
    if (!type) return room.slug ? `${label}: that room type isn't available.` : `${label}: choose a room type.`;
    const problem = partyProblem(type, room);
    if (problem) return `${label} (${type.name}): ${problem.message}`;
    used.set(type.slug, (used.get(type.slug) ?? 0) + 1);
    if (free && used.get(type.slug)! > (free.get(type.slug) ?? 0)) {
      return (free.get(type.slug) ?? 0) === 0 ? `${label}: ${type.name} is sold out for these dates.` : `${label}: no more ${type.name} rooms are free for these dates.`;
    }
    return null;
  });
  const general = rooms.length === 0 ? "Add a room." : rooms.length > maxRooms ? `You can request up to ${maxRooms} rooms online.` : null;
  return { ok: general === null && problems.every((p) => p === null), problems, general };
}

export type RoomQuote = { room: BuilderRoom; type: BuilderType; quote: Quote };

/** Per-room price lines for the rooms that have a type, and their total. Needs the nights of the stay. */
export function quoteRooms(rooms: BuilderRoom[], types: ReadonlyMap<string, BuilderType>, nights: number) {
  const lines: (RoomQuote | null)[] = rooms.map((room) => {
    const type = room.slug ? types.get(room.slug) : undefined;
    if (!type) return null;
    return {
      room,
      type,
      quote: computeQuote({ nights, pricePerNightNpr: type.basePriceNpr, childPricePerNightNpr: type.childPricePerNightNpr, children: room.children }),
    };
  });
  return { lines, totalPriceNpr: lines.reduce((n, l) => n + (l?.quote.totalPriceNpr ?? 0), 0) };
}

/** The most any room allows on each limit, for a room with no type chosen yet. */
export function largestCapacity(caps: Capacity[]): Capacity {
  return {
    maxGuests: Math.max(...caps.map((c) => c.maxGuests)),
    maxAdults: Math.max(...caps.map((c) => c.maxAdults)),
    maxChildren: caps.some((c) => c.maxChildren === null) ? null : Math.max(...caps.map((c) => c.maxChildren ?? 0)),
  };
}

/** The calculation shown under a chosen type: "NPR 4,500 × 2 nights = NPR 9,000", a child line, then the room total. */
export function calculationLines(quote: Quote, formatMoney: (npr: number) => string): string[] {
  const nights = plural(quote.nights, "night", "nights");
  const lines = [`${formatMoney(quote.pricePerNightNpr)} × ${nights} = ${formatMoney(quote.roomSubtotalNpr)}`];
  if (quote.children > 0 && quote.childPricePerNightNpr > 0) {
    lines.push(`${formatMoney(quote.childPricePerNightNpr)} × ${plural(quote.children, "child", "children")} × ${nights} = ${formatMoney(quote.childSubtotalNpr)}`);
  }
  lines.push(`Room total: ${formatMoney(quote.totalPriceNpr)}`);
  return lines;
}
