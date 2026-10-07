/** Guest counts on the search form. Children count toward the room's capacity, so adults + children never exceeds `maxGuests`. */
export type Party = { adults: number; children: number };
export type PartyField = keyof Party;

export const MIN_ADULTS = 1;

/** Which steppers can move: − stops at the minimum, + stops when the party fills the largest room. */
export function partyLimits(party: Party, maxGuests: number) {
  const full = party.adults + party.children >= maxGuests;
  return {
    canAddAdult: !full,
    canRemoveAdult: party.adults > MIN_ADULTS,
    canAddChild: !full,
    canRemoveChild: party.children > 0,
  };
}

/** Moves one count by `delta`, refusing any step past a limit (returns the party unchanged). */
export function stepParty(party: Party, field: PartyField, delta: 1 | -1, maxGuests: number): Party {
  const limits = partyLimits(party, maxGuests);
  const allowed =
    field === "adults" ? (delta > 0 ? limits.canAddAdult : limits.canRemoveAdult) : delta > 0 ? limits.canAddChild : limits.canRemoveChild;
  return allowed ? { ...party, [field]: party[field] + delta } : party;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "2 adults · 0 children" */
export function partySummary({ adults, children }: Party): string {
  return `${plural(adults, "adult", "adults")} · ${plural(children, "child", "children")}`;
}
