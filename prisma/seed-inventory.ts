/**
 * Idempotent inventory catalog seed.
 * - Matches items by name, case-insensitively.
 * - Creates missing items at quantity 0 with no movements and lowStockThreshold 0.
 * - Never changes an existing item (quantity, category, unit, anything) and
 *   reports items that already exist under a different category.
 * Never prints secret values.
 */
import { config as loadEnv } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import { INVENTORY_UNITS, type InventoryUnit } from "../src/config/inventory";

loadEnv({ path: ".env.local", quiet: true });

type Row = { name: string; unit: InventoryUnit; consumable: boolean };

/** [name, unit] pairs shared by one category and consumable flag. */
function group(category: string, consumable: boolean, items: [string, InventoryUnit][]) {
  return items.map(([name, unit]): Row & { category: string } => ({ category, name, unit, consumable }));
}

const pcs = (names: string[]) => names.map((n): [string, InventoryUnit] => [n, "pcs"]);

/** Reusable items that stay in the room at checkout (the owner's list); every other reusable goes to laundry. */
const FIXED_IN_ROOM = new Set(
  ["Electric kettle", "Drinking glass", "Mug", "Water jug", "Rechargeable lamp", "Flashlight", "Hanger", "Mosquito net", "Pillow", "Blanket/Quilt"].map(
    (name) => name.toLowerCase(),
  ),
);

const CATALOG = [
  ...group(
    "Linens & Bedding",
    false,
    pcs([
      "Bed sheet",
      "Duvet cover",
      "Pillowcase",
      "Pillow",
      "Blanket/Quilt",
      "Mattress protector",
      "Bath towel",
      "Hand towel",
      "Face towel",
      "Bath mat",
      "Mosquito net",
    ]),
  ),
  ...group("Bathroom Amenities", true, [
    ["Soap bar", "pcs"],
    ["Liquid soap", "L"],
    ["Shampoo", "bottle"],
    ["Conditioner", "bottle"],
    ["Body wash", "bottle"],
    ["Toilet paper", "roll"],
    ["Tissue box", "box"],
    ["Dental kit", "pcs"],
    ["Comb", "pcs"],
    ["Shower cap", "pcs"],
    ["Slippers", "pair"],
    ["Sanitary bag", "pack"],
    ["Bin liner - small", "pack"],
  ]),
  ...group("In-Room Supplies", true, [
    ["Drinking water", "bottle"],
    ["Tea sachet", "pack"],
    ["Coffee sachet", "pack"],
    ["Sugar sachet", "pack"],
    ["Mosquito coil", "pack"],
    ["Mosquito repellent", "bottle"],
    ["Candle", "pcs"],
    ["Matchbox", "box"],
    ["Battery AA", "pack"],
    ["Battery AAA", "pack"],
    ["Light bulb", "pcs"],
  ]),
  ...group(
    "In-Room Supplies",
    false,
    pcs(["Drinking glass", "Mug", "Electric kettle", "Rechargeable lamp", "Flashlight", "Hanger", "Laundry bag", "Water jug"]),
  ),
  ...group("Housekeeping & Cleaning", true, [
    ["Floor cleaner", "L"],
    ["Toilet cleaner", "bottle"],
    ["Glass cleaner", "bottle"],
    ["Disinfectant", "L"],
    ["Laundry detergent", "kg"],
    ["Fabric softener", "L"],
    ["Bleach", "L"],
    ["Garbage bag - large", "pack"],
    ["Garbage bag - small", "pack"],
    ["Cleaning gloves", "pair"],
    ["Air freshener", "bottle"],
    ["Insecticide spray", "bottle"],
  ]),
  ...group("Housekeeping & Cleaning", false, pcs(["Mop", "Broom", "Bucket", "Scrub brush", "Cleaning cloth", "Duster"])),
  ...group(
    "Room Service",
    false,
    pcs(["Serving tray", "Plate", "Bowl", "Spoon", "Fork", "Knife", "Thermos flask", "Jug", "Room service menu card"]),
  ),
  ...group("Room Service", true, [
    ["Napkin", "pack"],
    ["Order slip pad", "pad"],
  ]),
  ...group("Safety & Maintenance", true, [
    ["Bandage", "pack"],
    ["Antiseptic", "bottle"],
    ["ORS packet", "pack"],
    ["Fuse", "pcs"],
    ["Plumbing tape", "roll"],
  ]),
  ...group(
    "Safety & Maintenance",
    false,
    pcs(["First aid kit", "Fire extinguisher", "Spare lock", "Extension cord", "Screwdriver set"]),
  ),
  ...group("Front Desk & Admin", true, [
    ["Registration form", "pad"],
    ["Receipt book", "book"],
    ["Pen", "box"],
    ["Notebook", "pcs"],
    ["Printer paper", "ream"],
    ["Printer ink", "cartridge"],
    ["Welcome card", "pack"],
    ["Wi-Fi info card", "pack"],
  ]),
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  // Catalog sanity: valid units, no duplicate names.
  const seen = new Set<string>();
  for (const row of CATALOG) {
    if (!(INVENTORY_UNITS as readonly string[]).includes(row.unit)) throw new Error(`Bad unit for ${row.name}: ${row.unit}`);
    const key = row.name.toLowerCase();
    if (seen.has(key)) throw new Error(`Duplicate name in catalog: ${row.name}`);
    seen.add(key);
  }

  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
  try {
    const existing = await db.inventoryItem.findMany({ select: { name: true, category: true } });
    const byName = new Map(existing.map((item) => [item.name.toLowerCase(), item]));

    const toCreate: typeof CATALOG = [];
    const kept: string[] = [];
    const conflicts: string[] = [];
    for (const row of CATALOG) {
      const found = byName.get(row.name.toLowerCase());
      if (!found) toCreate.push(row);
      else if (found.category !== row.category) {
        conflicts.push(`${found.name}: kept in "${found.category}" (catalog says "${row.category}")`);
      } else kept.push(found.name);
    }

    // One round trip per table, all or nothing.
    await db.$transaction(
      async (tx) => {
        await tx.inventoryItem.createMany({
          data: toCreate.map((row) => ({
            name: row.name,
            category: row.category,
            unit: row.unit,
            isConsumable: row.consumable,
            isFixedInRoom: !row.consumable && FIXED_IN_ROOM.has(row.name.toLowerCase()),
            quantity: 0,
            lowStockThreshold: 0,
          })),
        });
        const created = await tx.inventoryItem.findMany({
          where: { name: { in: toCreate.map((row) => row.name) } },
          select: { id: true, name: true, category: true, unit: true },
        });
        await tx.activityLog.createMany({
          data: created.map((item) => ({
            userId: null,
            action: "inventoryItem.created",
            entityType: "InventoryItem",
            entityId: item.id,
            details: { name: item.name, category: item.category, unit: item.unit, source: "seed:inventory" },
          })),
        });
      },
      { timeout: 30_000 },
    );

    console.log(`Inventory seed: ${toCreate.length} created, ${kept.length} already present (unchanged).`);
    if (conflicts.length) console.log(`Category conflicts (not moved):\n  ${conflicts.join("\n  ")}`);

    const items = await db.inventoryItem.findMany({ select: { category: true, isConsumable: true } });
    const counts = new Map<string, { consumable: number; reusable: number }>();
    for (const { category, isConsumable } of items) {
      const c = counts.get(category) ?? { consumable: 0, reusable: 0 };
      c[isConsumable ? "consumable" : "reusable"]++;
      counts.set(category, c);
    }
    console.log("\nItems per category:");
    for (const [category, c] of [...counts].sort(([a], [b]) => a.localeCompare(b))) {
      console.log(`  ${category}: ${c.consumable + c.reusable} (${c.consumable} consumable, ${c.reusable} reusable)`);
    }
    console.log(`  Total: ${items.length}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
