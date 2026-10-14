import { toDecimal, type Quantity } from "@/lib/inventory/stock";

type Decimal = ReturnType<typeof toDecimal>;

/**
 * The par for one room: the room type's lines, with the room's overrides applied. An override replaces the
 * type's quantity for that item (0 removes it) or adds an item the type doesn't have.
 */
export function resolvePar(
  typeLines: readonly { itemId: string; quantity: Quantity }[],
  overrides: readonly { itemId: string; quantity: Quantity }[],
): Map<string, Decimal> {
  const par = new Map<string, Decimal>(typeLines.map((line) => [line.itemId, toDecimal(line.quantity)]));
  for (const override of overrides) {
    const quantity = toDecimal(override.quantity);
    if (quantity.isZero()) par.delete(override.itemId);
    else par.set(override.itemId, quantity);
  }
  return par;
}

export type ParChange = { itemId: string; quantity: string };
export type ParPlan = { upserts: ParChange[]; deletes: string[] };

const sameQuantity = (a: Quantity | undefined, b: Quantity | undefined) => a !== undefined && b !== undefined && toDecimal(a).equals(b);

/** Saving a room type's par list: the desired list replaces the stored one. */
export function planTypeParSave(desired: ReadonlyMap<string, Quantity>, current: ReadonlyMap<string, Quantity>): ParPlan {
  return {
    upserts: [...desired].filter(([id, q]) => !sameQuantity(q, current.get(id))).map(([itemId, q]) => ({ itemId, quantity: toDecimal(q).toString() })),
    deletes: [...current.keys()].filter((id) => !desired.has(id)),
  };
}

/**
 * Saving one room's par: the staff edit the room's effective list, and only the differences from the type
 * are stored as overrides (a quantity, or 0 for an item the type has but this room doesn't). Items that
 * match the type, or that aren't wanted by either, need no row.
 */
export function planRoomOverrides(
  desired: ReadonlyMap<string, Quantity>,
  typePar: ReadonlyMap<string, Quantity>,
  currentOverrides: ReadonlyMap<string, Quantity>,
): ParPlan {
  const wanted = new Map<string, string>();
  for (const [id, q] of desired) if (!sameQuantity(q, typePar.get(id))) wanted.set(id, toDecimal(q).toString());
  for (const id of typePar.keys()) if (!desired.has(id)) wanted.set(id, "0");

  return {
    upserts: [...wanted].filter(([id, q]) => !sameQuantity(q, currentOverrides.get(id))).map(([itemId, quantity]) => ({ itemId, quantity })),
    deletes: [...currentOverrides.keys()].filter((id) => !wanted.has(id)),
  };
}
