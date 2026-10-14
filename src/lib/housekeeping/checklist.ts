import { ActionError } from "@/lib/actions";
import { assertAmountFitsUnit, formatQuantityWithUnit, toDecimal, type Quantity } from "@/lib/inventory/stock";

type Decimal = ReturnType<typeof toDecimal>;

// ─── Prep ────────────────────────────────────────────────────────────────────

export type ItemInfo = { id: string; name: string; unit: string; isConsumable: boolean; isFixedInRoom: boolean; isActive: boolean };

export type PrepLine = {
  itemId: string;
  name: string;
  unit: string;
  isConsumable: boolean;
  /** What the room should hold. */
  par: string;
  /** Reusables already in the room (always 0 for consumables: they aren't tracked by room). */
  inRoom: string;
  /** What to place: par minus what is there (consumables: the full par). The most the staff can place. */
  need: string;
  /** What the store holds right now (consumables: the item total). */
  available: string;
};

/**
 * The prep checklist: par minus what is already in the room, for active items only. Items already fully
 * stocked drop off. `extras` (booking extras) are added on top of the par for the same item.
 */
export function buildPrepLines(params: {
  par: ReadonlyMap<string, Quantity>;
  extras?: ReadonlyMap<string, Quantity>;
  items: ReadonlyMap<string, ItemInfo>;
  inRoom: ReadonlyMap<string, Quantity>;
  available: ReadonlyMap<string, Quantity>;
}): PrepLine[] {
  const wanted = new Map<string, Decimal>();
  for (const [itemId, quantity] of params.par) wanted.set(itemId, toDecimal(quantity));
  for (const [itemId, quantity] of params.extras ?? []) wanted.set(itemId, (wanted.get(itemId) ?? toDecimal(0)).plus(quantity));

  const lines: PrepLine[] = [];
  for (const [itemId, par] of wanted) {
    const item = params.items.get(itemId);
    if (!item?.isActive) continue;
    const inRoom = item.isConsumable ? toDecimal(0) : toDecimal(params.inRoom.get(itemId) ?? 0);
    const need = atLeastZero(par.minus(inRoom));
    if (need.isZero()) continue;
    lines.push({
      itemId,
      name: item.name,
      unit: item.unit,
      isConsumable: item.isConsumable,
      par: par.toString(),
      inRoom: inRoom.toString(),
      need: need.toString(),
      available: toDecimal(params.available.get(itemId) ?? 0).toString(),
    });
  }
  return lines.sort((a, b) => a.name.localeCompare(b.name));
}

function atLeastZero(value: Decimal) {
  return value.isNegative() ? toDecimal(0) : value;
}

export type PrepPlanLine = {
  itemId: string;
  name: string;
  unit: string;
  isConsumable: boolean;
  /** What staff asked to place. */
  requested: string;
  /** What the store can actually cover. */
  placed: string;
  /** requested - placed; never silently dropped. */
  short: string;
};

export type PrepPlan = { lines: PrepPlanLine[]; shortfalls: PrepPlanLine[] };

/**
 * Turns what staff entered into what happens. Every line of the checklist must be answered, nothing may
 * exceed what was needed (the list changed: reload), and a store that can't cover a line puts the gap in
 * `shortfalls`. Completing a prep with a shortfall needs `acknowledgeShortfall`.
 */
export function planPrep(lines: readonly PrepLine[], submitted: Readonly<Record<string, string>>, acknowledgeShortfall: boolean): PrepPlan {
  const known = new Set(lines.map((l) => l.itemId));
  for (const itemId of Object.keys(submitted)) {
    if (!known.has(itemId)) throw new ActionError("The checklist has changed. Reload the page and go through it again.");
  }
  const plan: PrepPlanLine[] = [];
  for (const line of lines) {
    const raw = submitted[line.itemId];
    if (raw === undefined) throw new ActionError("The checklist has changed. Reload the page and go through it again.");
    let requested: Decimal;
    try {
      requested = toDecimal(raw.trim() === "" ? 0 : raw);
    } catch {
      throw new ActionError("Please fix the highlighted fields.", { [line.itemId]: "Enter a number." });
    }
    if (requested.isNegative()) throw new ActionError("Please fix the highlighted fields.", { [line.itemId]: "Can't be negative." });
    assertAmountFitsUnit(requested, line.unit, line.itemId);
    if (requested.greaterThan(line.need)) {
      throw new ActionError(
        `Only ${formatQuantityWithUnit(line.need, line.unit)} of ${line.name} is needed. Reload the page if the room was changed meanwhile.`,
        { [line.itemId]: `At most ${formatQuantityWithUnit(line.need, line.unit)}.` },
      );
    }
    const available = toDecimal(line.available);
    const placed = requested.greaterThan(available) ? available : requested;
    plan.push({
      itemId: line.itemId,
      name: line.name,
      unit: line.unit,
      isConsumable: line.isConsumable,
      requested: requested.toString(),
      placed: placed.toString(),
      short: requested.minus(placed).toString(),
    });
  }
  const shortfalls = plan.filter((line) => toDecimal(line.short).greaterThan(0));
  if (shortfalls.length > 0 && !acknowledgeShortfall) {
    const first = shortfalls[0];
    throw new ActionError(
      `The store is short on ${shortfalls.map((s) => s.name).join(", ")}. Confirm to complete with what is there.`,
      { [first.itemId]: `Store has ${formatQuantityWithUnit(toDecimal(first.requested).minus(first.short), first.unit)}, ${formatQuantityWithUnit(first.requested, first.unit)} asked.`, shortfall: "confirm" },
    );
  }
  return { lines: plan, shortfalls };
}

// ─── Inspection ──────────────────────────────────────────────────────────────

export type InspectionLine = {
  itemId: string;
  name: string;
  unit: string;
  isFixedInRoom: boolean;
  /** What the system says is in the room. */
  expected: string;
};

export type InspectionEntry = { counted: string; kind?: string; note?: string };

export type InspectionPlanLine = {
  itemId: string;
  name: string;
  unit: string;
  expected: string;
  counted: string;
  /** expected - counted */
  missing: string;
  kind: "LOST" | "DAMAGED" | null;
  note: string | null;
  /** What goes to the laundry: the counted amount of a non-fixed item. */
  toLaundry: string;
};

/**
 * Turns the counts into the moves and write-offs. Every reusable item in the room must be counted. A count
 * above what the system holds isn't taken (record a count in Record stock instead); every missing item
 * needs LOST or DAMAGED and a note.
 */
export function planInspection(
  lines: readonly InspectionLine[],
  submitted: Readonly<Record<string, InspectionEntry>>,
): InspectionPlanLine[] {
  if (lines.length === 0 && Object.keys(submitted).length > 0) {
    throw new ActionError("The system has no reusable items recorded in this room, so there is nothing to count. Reload the page.");
  }
  const known = new Set(lines.map((l) => l.itemId));
  for (const itemId of Object.keys(submitted)) {
    if (!known.has(itemId)) throw new ActionError("The room's contents have changed. Reload the page and count again.");
  }
  return lines.map((line) => {
    const entry = submitted[line.itemId];
    if (!entry) throw new ActionError("The room's contents have changed. Reload the page and count again.");
    const fail = (message: string): never => {
      throw new ActionError("Please fix the highlighted fields.", { [line.itemId]: message });
    };
    let counted: Decimal;
    try {
      counted = toDecimal(entry.counted.trim() === "" ? NaN : entry.counted);
    } catch {
      return fail("Enter how many are there.");
    }
    if (counted.isNaN()) return fail("Enter how many are there (0 if none).");
    if (counted.isNegative()) return fail("Can't be negative.");
    assertAmountFitsUnit(counted, line.unit, line.itemId);
    const expected = toDecimal(line.expected);
    if (counted.greaterThan(expected)) {
      return fail(`The system holds ${formatQuantityWithUnit(expected, line.unit)} here. For more, correct the count in Record stock first.`);
    }
    const missing = expected.minus(counted);
    let kind: "LOST" | "DAMAGED" | null = null;
    let note: string | null = null;
    if (missing.greaterThan(0)) {
      if (entry.kind !== "LOST" && entry.kind !== "DAMAGED") return fail("Choose lost or damaged for the missing ones.");
      kind = entry.kind;
      note = entry.note?.trim() || null;
      if (!note) return fail("Say what happened (for example: broken glass, guest took it).");
    }
    return {
      itemId: line.itemId,
      name: line.name,
      unit: line.unit,
      expected: expected.toString(),
      counted: counted.toString(),
      missing: missing.toString(),
      kind,
      note,
      toLaundry: line.isFixedInRoom ? "0" : counted.toString(),
    };
  });
}
