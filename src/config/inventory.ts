/**
 * Inventory vocabulary: the one place for units and category suggestions.
 * Items and stock levels live in the database.
 */
export const INVENTORY_UNITS = ["pcs", "kg", "L", "box", "pack"] as const;
export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

/** Units that can't be split: amounts must be whole numbers. */
const WHOLE_UNITS: readonly InventoryUnit[] = ["pcs", "box", "pack"];

export function isWholeUnit(unit: string): boolean {
  return (WHOLE_UNITS as readonly string[]).includes(unit);
}

/**
 * Suggestions offered in the category field. Categories are free text, so staff
 * can add their own; these only save typing. Owner to confirm or replace.
 */
export const SUGGESTED_CATEGORIES = [
  "Housekeeping",
  "Kitchen",
  "Beverages",
  "Toiletries",
  "Linen",
  "Maintenance",
] as const;

/** Number of decimal places stored for quantities. */
export const QUANTITY_DECIMALS = 2;
