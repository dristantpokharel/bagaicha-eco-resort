/**
 * The one occupancy rule. A party fits a room type when
 *   adults >= 1, adults <= maxAdults, adults + children <= maxGuests,
 *   and children <= maxChildren when that is set.
 * Everything that checks capacity (availability, results, alternatives, submit, admin booking forms,
 * the steppers, labels) goes through here.
 */
export type Capacity = { maxGuests: number; maxAdults: number; maxChildren: number | null };
export type Party = { adults: number; children: number };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function partyFits(cap: Capacity, { adults, children }: Party): boolean {
  return partyProblem(cap, { adults, children }) === null;
}

/** Why a party doesn't fit, as a message for the field it belongs to. Null when it fits. */
export function partyProblem(cap: Capacity, { adults, children }: Party): { field: "adults" | "children"; message: string } | null {
  if (adults < 1) return { field: "adults", message: "At least 1 adult is needed." };
  if (adults > cap.maxAdults) {
    return { field: "adults", message: `This room takes up to ${plural(cap.maxAdults, "adult", "adults")}.` };
  }
  if (adults + children > cap.maxGuests) {
    return { field: "adults", message: `This room sleeps up to ${cap.maxGuests} guests, children included.` };
  }
  if (cap.maxChildren !== null && children > cap.maxChildren) {
    return { field: "children", message: `This room takes up to ${plural(cap.maxChildren, "child", "children")}.` };
  }
  return null;
}

/** Types whose limits the party meets. */
export function fittingTypes<T extends Capacity>(types: T[], party: Party): T[] {
  return types.filter((t) => partyFits(t, party));
}

/** ["up to 3", "max 2 adults"]: only limits that actually restrict are listed. */
function capacityParts(cap: Capacity): string[] {
  const parts = [`up to ${cap.maxGuests}`];
  if (cap.maxAdults < cap.maxGuests) parts.push(`max ${plural(cap.maxAdults, "adult", "adults")}`);
  if (cap.maxChildren !== null) parts.push(`max ${plural(cap.maxChildren, "child", "children")}`);
  return parts;
}

/** "up to 3, max 2 adults" (room pills) */
export const describeCapacityShort = (cap: Capacity) => capacityParts(cap).join(", ");

/** "Up to 3 guests, max 2 adults"; with `childrenIncluded`: "Up to 3 guests, children included, max 2 adults". */
export function describeCapacity(cap: Capacity, options: { childrenIncluded?: boolean } = {}): string {
  const [guests, ...rest] = capacityParts(cap);
  const total = `${guests[0].toUpperCase()}${guests.slice(1)} ${cap.maxGuests === 1 ? "guest" : "guests"}`;
  return [total, ...(options.childrenIncluded ? ["children included"] : []), ...rest].join(", ");
}

/** Admin: the limits can't contradict the total. Returns field errors, empty when valid. */
export function capacityErrors(cap: Capacity): Partial<Record<"maxAdults" | "maxChildren", string>> {
  const errors: Partial<Record<"maxAdults" | "maxChildren", string>> = {};
  if (cap.maxAdults < 1) errors.maxAdults = "At least 1 adult.";
  else if (cap.maxAdults > cap.maxGuests) errors.maxAdults = "Can't be more than the maximum guests.";
  if (cap.maxChildren !== null) {
    if (cap.maxChildren < 0) errors.maxChildren = "Can't be negative.";
    else if (cap.maxChildren > cap.maxGuests) errors.maxChildren = "Can't be more than the maximum guests.";
  }
  return errors;
}
