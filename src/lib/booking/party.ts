import { BOOKING } from "@/config/booking";
import type { Capacity, Party } from "./capacity";
import { canSeatFromFree } from "./multi-room";

/** Guest counts on the search form. */
export type { Party };
export type PartyField = keyof Party;

export const MIN_ADULTS = 1;

/** Room types and how many rooms of each there are; the party may be spread over several (up to the online limit). */
export type SeatPool = { cap: Capacity; count: number }[];

const seatable = (pool: SeatPool, party: Party) =>
  canSeatFromFree(party, pool.map(({ cap, count }) => ({ type: cap, free: count })));

/**
 * Which steppers can move. `pool` is the selected room type's limits and room count, or every type's for "Any room":
 * + is allowed while some combination of up to BOOKING.maxRoomsPerRequest rooms would still hold the bigger party.
 * − stops at 1 adult / 0 children.
 */
export function partyLimits(party: Party, pool: SeatPool) {
  return {
    canAddAdult: seatable(pool, { ...party, adults: party.adults + 1 }),
    canRemoveAdult: party.adults > MIN_ADULTS,
    canAddChild: seatable(pool, { ...party, children: party.children + 1 }),
    canRemoveChild: party.children > 0,
  };
}

/** Moves one count by `delta`, refusing any step past a limit (returns the party unchanged). */
export function stepParty(party: Party, field: PartyField, delta: 1 | -1, pool: SeatPool): Party {
  const limits = partyLimits(party, pool);
  const allowed =
    field === "adults" ? (delta > 0 ? limits.canAddAdult : limits.canRemoveAdult) : delta > 0 ? limits.canAddChild : limits.canRemoveChild;
  return allowed ? { ...party, [field]: party[field] + delta } : party;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "2 adults · 0 children" */
export function partySummary({ adults, children }: Party): string {
  return `${plural(adults, "adult", "adults")} · ${plural(children, "child", "children")}`;
}

/**
 * A note for a disabled + button, so it never looks broken; null when both + buttons work.
 * `typeName` is set when one room type is selected.
 */
export function capacityNote(party: Party, pool: SeatPool, typeName?: string): string | null {
  const { canAddAdult, canAddChild } = partyLimits(party, pool);
  if (canAddAdult && canAddChild) return null;
  const single = pool.length === 1 && pool[0].count === 1 ? pool[0].cap : null;
  if (single) {
    const total = party.adults + party.children;
    const name = typeName ?? "This room";
    if (total >= single.maxGuests) return `${name} sleeps up to ${single.maxGuests} guests, children included.`;
    if (!canAddAdult && !canAddChild) return `${name} can't take more of this group.`;
    if (!canAddAdult) return `${name} takes up to ${plural(single.maxAdults, "adult", "adults")}.`;
    return `${name} takes up to ${plural(single.maxChildren ?? 0, "child", "children")}.`;
  }
  const rooms = BOOKING.maxRoomsPerRequest;
  if (!canAddAdult && !canAddChild) return `That's the most we can seat online (up to ${rooms} rooms). For a larger group, please send an enquiry.`;
  return canAddAdult ? "No room combination takes more children with this many adults." : "No room combination takes more adults with this many children.";
}

/** "0–12" for a child age limit of 13 (children are younger than the limit). */
export const childAgeRange = (childUnderAge: number) => `0–${childUnderAge - 1}`;
