import { db } from "@/lib/db";
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
