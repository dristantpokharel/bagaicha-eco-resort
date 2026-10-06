import { db } from "@/lib/db";
import { locationInclude, toLocationRef } from "./locations";
import { isLowStock } from "./stock";

/** Active items first by name; the inventory is small, so filtering is done in memory. */
export async function listInventoryItems(options: { includeArchived?: boolean } = {}) {
  return db.inventoryItem.findMany({
    where: options.includeArchived ? {} : { isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function listCategories() {
  const rows = await db.inventoryItem.findMany({ distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } });
  return rows.map((row) => row.category);
}

/** Active low-stock items, furthest below their threshold first. */
export async function listLowStockItems() {
  const items = await listInventoryItems();
  return items
    .filter(isLowStock)
    .sort((a, b) => {
      const ratio = (item: typeof a) => item.quantity.div(item.lowStockThreshold).toNumber();
      return ratio(a) - ratio(b) || a.name.localeCompare(b.name);
    });
}

// ─── Locations (reusable stock by place) ─────────────────────────────────────

const KIND_ORDER = { STORE: 0, LAUNDRY: 1, ROOM: 2 } as const;

/** Store, Laundry, then rooms by name. Archived rooms are included so stock left in them stays visible. */
export async function listLocations() {
  const rows = await db.stockLocation.findMany({ include: locationInclude });
  return rows
    .map(toLocationRef)
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.label.localeCompare(b.label, undefined, { numeric: true }));
}

/** Active reusable items with where each one sits; feeds the move and write-off pickers. */
export async function listReusableItemsWithBalances() {
  const items = await db.inventoryItem.findMany({
    where: { isActive: true, isConsumable: false },
    orderBy: { name: "asc" },
    include: { balances: { select: { locationId: true, quantity: true } } },
  });
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    quantity: item.quantity.toString(),
    balances: Object.fromEntries(item.balances.filter((b) => !b.quantity.isZero()).map((b) => [b.locationId, b.quantity.toString()])),
  }));
}

/** What one location holds right now (items with a non-zero balance), by category then name. */
export async function listLocationStock(locationId: string) {
  const rows = await db.stockBalance.findMany({
    where: { locationId, quantity: { gt: 0 }, item: { isActive: true } },
    include: { item: { select: { id: true, name: true, category: true, unit: true, isFixedInRoom: true } } },
  });
  return rows
    .map((row) => ({ ...row.item, quantity: row.quantity }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

/** Reusable items whose total differs from the sum of their location balances. Should always be empty. */
export async function findBalanceMismatches() {
  return db.$queryRaw<{ id: string; name: string; total: string; balances: string }[]>`
    SELECT i.id, i.name, i.quantity::text AS total, COALESCE(sum(b.quantity), 0)::text AS balances
    FROM inventory_items i
    LEFT JOIN stock_balances b ON b."itemId" = i.id
    WHERE NOT i."isConsumable"
    GROUP BY i.id
    HAVING i.quantity <> COALESCE(sum(b.quantity), 0)`;
}
