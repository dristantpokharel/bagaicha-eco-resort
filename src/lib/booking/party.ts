import { partyFits, type Capacity, type Party } from "./capacity";

/** Guest counts on the search form. */
export type { Party };
export type PartyField = keyof Party;

export const MIN_ADULTS = 1;

/**
 * Which steppers can move. `caps` is the selected room type's limits, or every type's for "Any room":
 * + is allowed while at least one of them would still take the bigger party. − stops at 1 adult / 0 children.
 */
export function partyLimits(party: Party, caps: Capacity[]) {
  const fitsSome = (p: Party) => caps.some((c) => partyFits(c, p));
  return {
    canAddAdult: fitsSome({ ...party, adults: party.adults + 1 }),
    canRemoveAdult: party.adults > MIN_ADULTS,
    canAddChild: fitsSome({ ...party, children: party.children + 1 }),
    canRemoveChild: party.children > 0,
  };
}

/** Moves one count by `delta`, refusing any step past a limit (returns the party unchanged). */
export function stepParty(party: Party, field: PartyField, delta: 1 | -1, caps: Capacity[]): Party {
  const limits = partyLimits(party, caps);
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
export function capacityNote(party: Party, caps: Capacity[], typeName?: string): string | null {
  const { canAddAdult, canAddChild } = partyLimits(party, caps);
  if (canAddAdult && canAddChild) return null;
  const total = party.adults + party.children;
  const cap = caps.length === 1 ? caps[0] : null;
  if (!cap) {
    const largest = Math.max(...caps.map((c) => c.maxGuests));
    if (!canAddAdult && !canAddChild) return total >= largest ? `Our largest room sleeps ${largest} guests, children included.` : "No room takes a larger group like this.";
    return canAddAdult ? "No room takes more children with this many adults." : "No room takes more adults with this many children.";
  }
  const name = typeName ?? "This room";
  if (total >= cap.maxGuests) return `${name} sleeps up to ${cap.maxGuests} guests, children included.`;
  if (!canAddAdult && !canAddChild) return `${name} can't take more of this group.`;
  if (!canAddAdult) return `${name} takes up to ${plural(cap.maxAdults, "adult", "adults")}.`;
  return `${name} takes up to ${plural(cap.maxChildren ?? 0, "child", "children")}.`;
}

/** "0–12" for a child age limit of 13 (children are younger than the limit). */
export const childAgeRange = (childUnderAge: number) => `0–${childUnderAge - 1}`;
