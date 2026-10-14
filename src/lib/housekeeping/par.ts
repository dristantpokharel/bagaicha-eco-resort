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
