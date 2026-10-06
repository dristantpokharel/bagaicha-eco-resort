import type { Prisma } from "@/generated/prisma/client";
import type { StockMovementType } from "@/generated/prisma/enums";
import { ActionError } from "@/lib/actions";
import { logActivity } from "@/lib/activity-log";
import { applyMovement, formatQuantityWithUnit, type Quantity } from "./stock";

type Tx = Prisma.TransactionClient;

/**
 * Serialises changes to one item's quantity: every movement takes this lock
 * first, so two people using the same stock at once can't both pass the
 * "enough in stock" check. Held until the transaction ends.
 */
export async function lockItem(tx: Tx, itemId: string) {
  await tx.$queryRaw`SELECT id FROM inventory_items WHERE id = ${itemId} FOR UPDATE`;
}

/**
 * Applies one stock movement. The item row is locked, the quantity is re-read,
 * and the new quantity, the movement row and the activity log entry are written
 * together. Must run inside a transaction; the caller supplies the user.
 */
export async function recordStockMovement(
  tx: Tx,
  params: {
    itemId: string;
    userId: string;
    type: StockMovementType;
    amount: Quantity;
    note: string | null;
    /** A repeat of an already-saved submission returns that movement instead of adding another. */
    submissionId?: string;
  },
) {
  const { itemId, userId, type, amount, note, submissionId } = params;
  await lockItem(tx, itemId);

  if (submissionId) {
    const prior = await tx.stockMovement.findUnique({
      where: { submissionId },
      include: { item: { select: { name: true, unit: true } } },
    });
    if (prior) {
      if (prior.itemId !== itemId || prior.userId !== userId) {
        throw new ActionError("That submission was already used. Reload the page and try again.");
      }
      return {
        movement: prior,
        itemName: prior.item.name,
        unit: prior.item.unit,
        balanceAfter: prior.balanceAfter,
        duplicate: true,
        summary: `Already saved. ${summarize(prior.type, prior.item.name, prior.item.unit, prior.quantity, prior.balanceAfter)}`,
      };
    }
  }

  const item = await tx.inventoryItem.findUnique({
    where: { id: itemId },
    select: { name: true, unit: true, quantity: true, isActive: true },
  });
  if (!item) throw new ActionError("That item no longer exists.");
  if (!item.isActive) throw new ActionError(`${item.name} is archived. Make it active again before recording stock.`);

  const { delta, balanceAfter } = applyMovement({ type, current: item.quantity, amount, unit: item.unit });

  await tx.inventoryItem.update({ where: { id: itemId }, data: { quantity: balanceAfter } });
  const movement = await tx.stockMovement.create({
    data: { itemId, type, quantity: delta, balanceAfter, note, userId, submissionId },
  });
  await logActivity(tx, {
    userId,
    action: `stock.${type.toLowerCase()}`,
    entityType: "InventoryItem",
    entityId: itemId,
    details: {
      item: item.name,
      unit: item.unit,
      change: delta.toString(),
      before: item.quantity.toString(),
      after: balanceAfter.toString(),
      ...(note ? { note } : {}),
    },
  });

  return {
    movement,
    itemName: item.name,
    unit: item.unit,
    balanceAfter,
    duplicate: false,
    summary: summarize(type, item.name, item.unit, delta, balanceAfter),
  };
}

function summarize(type: StockMovementType, name: string, unit: string, delta: Quantity, balanceAfter: Quantity) {
  const amount = formatQuantityWithUnit(String(delta).replace("-", ""), unit);
  const left = formatQuantityWithUnit(balanceAfter, unit);
  switch (type) {
    case "RECEIVED":
      return `Received ${amount} of ${name}. Now ${left}.`;
    case "USED":
      return `Used ${amount} of ${name}. ${left} left.`;
    case "ADJUSTED":
      return `${name} adjusted to ${left}.`;
  }
}
