"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, BOOKING_TX_OPTIONS } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { ActionError, parseForm, runAction, type ActionResult } from "@/lib/actions";
import { lockItem, recordStockMovement, transferStock, writeOffStock } from "@/lib/inventory/service";
import { getBalance, loadFixedLocation, setBalance } from "@/lib/inventory/locations";
import { canonicalCategory } from "@/lib/inventory/stock";
import {
  createItemSchema,
  recordMovementSchema,
  setItemActiveSchema,
  transferStockSchema,
  updateItemSchema,
  writeOffStockSchema,
} from "@/lib/inventory/schemas";

const INVENTORY_PATH = "/admin/inventory";

function revalidateInventory(itemId?: string) {
  revalidatePath(INVENTORY_PATH);
  revalidatePath("/admin");
  if (itemId) revalidatePath(`${INVENTORY_PATH}/${itemId}`);
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const NAME_TAKEN = new ActionError("An item with that name already exists.", { name: "Already in use." });

async function existingCategories(tx: Prisma.TransactionClient) {
  const rows = await tx.inventoryItem.findMany({ distinct: ["category"], select: { category: true } });
  return rows.map((row) => row.category);
}

/**
 * Switching an item between consumable and reusable changes whether its stock is tracked by place.
 * To reusable: everything on hand is counted as sitting in the Store.
 * To consumable: only allowed when all of it is in the Store, so no stock gets orphaned.
 */
async function changeTracking(tx: Prisma.TransactionClient, itemId: string, toConsumable: boolean) {
  await lockItem(tx, itemId);
  const item = await tx.inventoryItem.findUniqueOrThrow({ where: { id: itemId }, select: { quantity: true } });
  const store = await loadFixedLocation(tx, "STORE");
  if (toConsumable) {
    const inStore = await getBalance(tx, itemId, store.id);
    if (!inStore.equals(item.quantity)) {
      throw new ActionError(
        "Some of this item is in the laundry or a room. Move it all back to the Store before making it a consumable.",
        { isConsumable: "Move all stock to the Store first." },
      );
    }
    await tx.stockBalance.deleteMany({ where: { itemId } });
  } else if (item.quantity.greaterThan(0)) {
    await setBalance(tx, itemId, store.id, item.quantity);
  }
}

// ─── Items (Admin and up) ────────────────────────────────────────────────────

export async function createItem(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let createdId: string | null = null;
  const result = await runAction(async () => {
    const actor = await requirePermission("inventory.manageItems");
    const { openingQuantity, ...input } = parseForm(createItemSchema, formData);

    try {
      createdId = await db.$transaction(async (tx) => {
        const category = canonicalCategory(input.category, await existingCategories(tx));
        const item = await tx.inventoryItem.create({ data: { ...input, category } });
        await logActivity(tx, {
          userId: actor.id,
          action: "inventoryItem.created",
          entityType: "InventoryItem",
          entityId: item.id,
          details: { name: item.name, category, unit: item.unit },
        });
        // Opening stock goes through a movement so quantity always equals the movement history.
        if (Number(openingQuantity) > 0) {
          await recordStockMovement(tx, {
            itemId: item.id,
            userId: actor.id,
            type: "ADJUSTED",
            amount: openingQuantity,
            note: "Opening stock",
          });
        }
        return item.id;
      }, BOOKING_TX_OPTIONS);
    } catch (error) {
      if (isUniqueViolation(error)) throw NAME_TAKEN;
      throw error;
    }

    revalidateInventory();
    return { ok: true, message: `${input.name} added.` };
  });

  // redirect() throws, so it must run outside runAction's try/catch.
  if (result.ok && createdId) redirect(`${INVENTORY_PATH}/${createdId}?created=1`);
  return result;
}

export async function updateItem(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("inventory.manageItems");
    const { itemId, ...input } = parseForm(updateItemSchema, formData);

    try {
      await db.$transaction(async (tx) => {
        const before = await tx.inventoryItem.findUnique({ where: { id: itemId } });
        if (!before) throw new ActionError("That item no longer exists.");

        if (input.unit !== before.unit && (await tx.stockMovement.count({ where: { itemId } })) > 0) {
          throw new ActionError("The unit can't change once stock has been recorded. Archive this item and add a new one.", {
            unit: "Can't change after stock was recorded.",
          });
        }

        if (input.isConsumable !== before.isConsumable) {
          await changeTracking(tx, itemId, input.isConsumable);
        }

        const category = canonicalCategory(input.category, await existingCategories(tx));
        const data = { ...input, category };
        await tx.inventoryItem.update({ where: { id: itemId }, data });

        const changed = (Object.keys(data) as (keyof typeof data)[]).filter(
          (key) => String(before[key] ?? "") !== String(data[key] ?? ""),
        );
        if (changed.length) {
          await logActivity(tx, {
            userId: actor.id,
            action: "inventoryItem.updated",
            entityType: "InventoryItem",
            entityId: itemId,
            details: Object.fromEntries(
              changed.map((key) => [key, { from: before[key] === null ? null : String(before[key]), to: data[key] === null ? null : String(data[key]) }]),
            ),
          });
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw NAME_TAKEN;
      throw error;
    }

    revalidateInventory(itemId);
    return { ok: true, message: "Item saved." };
  });
}

export async function setItemActive(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("inventory.manageItems");
    const { itemId, isActive } = parseForm(setItemActiveSchema, formData);

    await db.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id: itemId }, select: { isActive: true } });
      if (!item) throw new ActionError("That item no longer exists.");
      if (item.isActive === isActive) return;
      await tx.inventoryItem.update({ where: { id: itemId }, data: { isActive } });
      await logActivity(tx, {
        userId: actor.id,
        action: isActive ? "inventoryItem.activated" : "inventoryItem.archived",
        entityType: "InventoryItem",
        entityId: itemId,
      });
    });

    revalidateInventory(itemId);
    return {
      ok: true,
      message: isActive ? "Item is active again." : "Item archived. It no longer appears in the list or low-stock alerts.",
    };
  });
}

// ─── Stock movements (all roles) ─────────────────────────────────────────────

export async function recordMovement(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("inventory.recordMovements");
    const { itemId, type, quantity, note, submissionId, locationId } = parseForm(recordMovementSchema, formData);

    const { summary } = await db.$transaction(
      (tx) =>
        recordStockMovement(tx, {
          itemId,
          userId: actor.id,
          type,
          amount: quantity,
          note,
          submissionId,
          locationId: locationId ?? undefined,
        }),
      BOOKING_TX_OPTIONS,
    );

    revalidateInventory(itemId);
    return { ok: true, message: summary };
  });
}

export async function moveStock(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("inventory.recordMovements");
    const { itemId, fromLocationId, toLocationId, quantity, note, submissionId } = parseForm(transferStockSchema, formData);

    const { summary } = await db.$transaction(
      (tx) => transferStock(tx, { itemId, userId: actor.id, fromLocationId, toLocationId, amount: quantity, note, submissionId }),
      BOOKING_TX_OPTIONS,
    );

    revalidateInventory(itemId);
    return { ok: true, message: summary };
  });
}

export async function writeOffItem(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("inventory.recordMovements");
    const { itemId, kind, fromLocationId, quantity, note, submissionId } = parseForm(writeOffStockSchema, formData);

    const { summary } = await db.$transaction(
      (tx) => writeOffStock(tx, { itemId, userId: actor.id, kind, fromLocationId, amount: quantity, note, submissionId }),
      BOOKING_TX_OPTIONS,
    );

    revalidateInventory(itemId);
    return { ok: true, message: summary };
  });
}

/** Laundry → Store: several items at once. One token per row keeps a retry from moving anything twice. */
export async function markWashed(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("inventory.recordMovements");
    const submissionId = String(formData.get("submissionId") ?? "");
    const rows = washedRows(formData);
    if (rows.length === 0) throw new ActionError("Enter how many of at least one item were washed.");

    const summaries = await db.$transaction(async (tx) => {
      const store = await loadFixedLocation(tx, "STORE");
      const laundry = await loadFixedLocation(tx, "LAUNDRY");
      const out: string[] = [];
      for (const { itemId, quantity } of rows) {
        const parsed = transferStockSchema.safeParse({
          itemId,
          submissionId: `${submissionId}-${itemId}`.slice(0, 64),
          fromLocationId: laundry.id,
          toLocationId: store.id,
          quantity,
          note: "Washed",
        });
        if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Check the amounts.");
        const done = await transferStock(tx, {
          itemId,
          userId: actor.id,
          fromLocationId: laundry.id,
          toLocationId: store.id,
          amount: parsed.data.quantity,
          note: "Washed",
          submissionId: parsed.data.submissionId,
        });
        out.push(done.summary);
      }
      return out;
    }, { ...BOOKING_TX_OPTIONS, timeout: 30_000 });

    revalidateInventory();
    return { ok: true, message: `${summaries.length} item${summaries.length === 1 ? "" : "s"} back in the Store.` };
  });
}

/** Form fields named `washed:<itemId>`; blank and zero rows are skipped. */
function washedRows(formData: FormData) {
  const rows: { itemId: string; quantity: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("washed:") || typeof value !== "string") continue;
    const quantity = value.replace(/[,\s]/g, "");
    if (quantity === "" || Number(quantity) === 0) continue;
    rows.push({ itemId: key.slice("washed:".length), quantity });
  }
  return rows;
}
