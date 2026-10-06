"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, BOOKING_TX_OPTIONS } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { ActionError, parseForm, runAction, type ActionResult } from "@/lib/actions";
import { recordStockMovement } from "@/lib/inventory/service";
import { canonicalCategory } from "@/lib/inventory/stock";
import { createItemSchema, recordMovementSchema, setItemActiveSchema, updateItemSchema } from "@/lib/inventory/schemas";

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
    const { itemId, type, quantity, note, submissionId } = parseForm(recordMovementSchema, formData);

    const { summary } = await db.$transaction(
      (tx) => recordStockMovement(tx, { itemId, userId: actor.id, type, amount: quantity, note, submissionId }),
      BOOKING_TX_OPTIONS,
    );

    revalidateInventory(itemId);
    return { ok: true, message: summary };
  });
}
