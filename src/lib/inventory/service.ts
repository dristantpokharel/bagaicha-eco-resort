import type { Prisma } from "@/generated/prisma/client";
import type { StockMovementType } from "@/generated/prisma/enums";
import { ActionError } from "@/lib/actions";
import { logActivity } from "@/lib/activity-log";
import { getBalance, loadFixedLocation, loadLocation, setBalance, type LocationRef } from "./locations";
import { applyMovement, assertAmountFitsUnit, formatQuantityWithUnit, toDecimal, type Quantity } from "./stock";

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
    /** Reusable items only: which location an ADJUSTED count is for. Defaults to the Store. */
    locationId?: string;
  },
) {
  const { itemId, userId, type, amount, note, submissionId, locationId } = params;
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
    select: { name: true, unit: true, quantity: true, isActive: true, isConsumable: true },
  });
  if (!item) throw new ActionError("That item no longer exists.");
  if (!item.isActive) throw new ActionError(`${item.name} is archived. Make it active again before recording stock.`);

  // Consumables have one total. Reusable items also track where each one is:
  // deliveries land in the Store, and a count is taken at one location.
  let delta: Quantity;
  let balanceAfter: Quantity;
  let fromLocation: LocationRef | null = null;
  let toLocation: LocationRef | null = null;

  if (item.isConsumable) {
    ({ delta, balanceAfter } = applyMovement({ type, current: item.quantity, amount, unit: item.unit }));
  } else {
    if (type === "USED") {
      throw new ActionError(
        `${item.name} is reusable, so it isn't used up. Use Move to shift it between places, or Lost / damaged if it is gone.`,
      );
    }
    const where = type === "RECEIVED" ? await loadFixedLocation(tx, "STORE") : await countLocation(tx, locationId);
    const current = type === "ADJUSTED" ? await getBalance(tx, itemId, where.id) : item.quantity;
    const applied = applyMovement({ type, current, amount, unit: item.unit });
    delta = applied.delta;
    balanceAfter = item.quantity.plus(applied.delta);
    const atLocation = type === "ADJUSTED" ? applied.balanceAfter : (await getBalance(tx, itemId, where.id)).plus(applied.delta);
    await setBalance(tx, itemId, where.id, atLocation);
    if (toDecimal(delta).isNegative()) fromLocation = where;
    else toLocation = where;
  }

  await tx.inventoryItem.update({ where: { id: itemId }, data: { quantity: balanceAfter } });
  const movement = await tx.stockMovement.create({
    data: {
      itemId,
      type,
      quantity: delta,
      balanceAfter,
      note,
      userId,
      submissionId,
      fromLocationId: fromLocation?.id,
      toLocationId: toLocation?.id,
    },
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
      ...(fromLocation || toLocation ? { location: (fromLocation ?? toLocation)!.label } : {}),
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

async function countLocation(tx: Tx, locationId: string | undefined) {
  if (!locationId) return loadFixedLocation(tx, "STORE");
  const location = await loadLocation(tx, locationId);
  if (!location.isActive) throw new ActionError(`${location.label} is archived.`);
  return location;
}

/** What a repeat of an already-saved submission returns for a move or write-off. */
async function findDuplicate(tx: Tx, submissionId: string | undefined, itemId: string, userId: string) {
  if (!submissionId) return null;
  const prior = await tx.stockMovement.findUnique({ where: { submissionId } });
  if (!prior) return null;
  if (prior.itemId !== itemId || prior.userId !== userId) {
    throw new ActionError("That submission was already used. Reload the page and try again.");
  }
  return prior;
}

async function loadReusableItem(tx: Tx, itemId: string) {
  const item = await tx.inventoryItem.findUnique({
    where: { id: itemId },
    select: { name: true, unit: true, quantity: true, isActive: true, isConsumable: true },
  });
  if (!item) throw new ActionError("That item no longer exists.");
  if (!item.isActive) throw new ActionError(`${item.name} is archived. Make it active again before recording stock.`);
  if (item.isConsumable) {
    throw new ActionError(`${item.name} is a consumable, so it has no locations. Record it as used instead.`);
  }
  return item;
}

function enoughAt(location: LocationRef, have: Quantity, want: Quantity, unit: string): never | void {
  if (toDecimal(want).greaterThan(have)) {
    throw new ActionError(
      `Only ${formatQuantityWithUnit(have, unit)} at ${location.label}. You can't take ${formatQuantityWithUnit(want, unit)}.`,
      { quantity: `Only ${formatQuantityWithUnit(have, unit)} at ${location.label}.` },
    );
  }
}

function positiveAmount(amount: Quantity, unit: string) {
  const value = toDecimal(amount);
  if (value.lessThanOrEqualTo(0)) throw new ActionError("Enter an amount above zero.", { quantity: "Enter an amount above zero." });
  assertAmountFitsUnit(value, unit, "quantity");
  return value;
}

/**
 * Moves reusable stock between two locations (Store → Room, Room → Laundry…).
 * The item total does not change, only where it sits.
 */
export async function transferStock(
  tx: Tx,
  params: {
    itemId: string;
    userId: string;
    fromLocationId: string;
    toLocationId: string;
    amount: Quantity;
    note: string | null;
    bookingId?: string | null;
    submissionId?: string;
  },
) {
  const { itemId, userId, fromLocationId, toLocationId, note, submissionId } = params;
  await lockItem(tx, itemId);

  const prior = await findDuplicate(tx, submissionId, itemId, userId);
  if (prior) return { movement: prior, duplicate: true, summary: "Already saved." };

  const item = await loadReusableItem(tx, itemId);
  if (fromLocationId === toLocationId) throw new ActionError("Choose two different places.", { toLocationId: "Must differ from the source." });
  const [from, to] = [await loadLocation(tx, fromLocationId), await loadLocation(tx, toLocationId)];
  if (!to.isActive) throw new ActionError(`${to.label} is archived, so stock can't be moved there.`, { toLocationId: "Archived." });
  const amount = positiveAmount(params.amount, item.unit);

  const fromBalance = await getBalance(tx, itemId, from.id);
  enoughAt(from, fromBalance, amount, item.unit);
  const toBalance = await getBalance(tx, itemId, to.id);
  await setBalance(tx, itemId, from.id, fromBalance.minus(amount));
  await setBalance(tx, itemId, to.id, toBalance.plus(amount));

  const movement = await tx.stockMovement.create({
    data: {
      itemId,
      type: "TRANSFERRED",
      quantity: amount,
      balanceAfter: item.quantity,
      note,
      userId,
      submissionId,
      fromLocationId: from.id,
      toLocationId: to.id,
      bookingId: params.bookingId ?? null,
    },
  });
  await logActivity(tx, {
    userId,
    action: "stock.transferred",
    entityType: "InventoryItem",
    entityId: itemId,
    details: {
      item: item.name,
      unit: item.unit,
      amount: amount.toString(),
      from: from.label,
      to: to.label,
      ...(note ? { note } : {}),
    },
  });

  const moved = formatQuantityWithUnit(amount.toString(), item.unit);
  return { movement, duplicate: false, summary: `Moved ${moved} of ${item.name} from ${from.label} to ${to.label}.` };
}

/** Takes reusable stock out of a location because it is lost or broken. Lowers the item total. */
export async function writeOffStock(
  tx: Tx,
  params: {
    itemId: string;
    userId: string;
    kind: "LOST" | "DAMAGED";
    fromLocationId: string;
    amount: Quantity;
    /** Required: say what happened. */
    note: string | null;
    bookingId?: string | null;
    submissionId?: string;
  },
) {
  const { itemId, userId, kind, fromLocationId, submissionId } = params;
  const note = params.note?.trim() || null;
  await lockItem(tx, itemId);

  const prior = await findDuplicate(tx, submissionId, itemId, userId);
  if (prior) return { movement: prior, duplicate: true, summary: "Already saved." };

  if (!note) throw new ActionError("Say what happened.", { note: "Say what happened (for example: broken glass, guest took it)." });
  const item = await loadReusableItem(tx, itemId);
  const from = await loadLocation(tx, fromLocationId);
  const amount = positiveAmount(params.amount, item.unit);

  if (params.bookingId) {
    const booking = await tx.booking.findUnique({ where: { id: params.bookingId }, select: { id: true } });
    if (!booking) throw new ActionError("That booking no longer exists.");
  }

  const fromBalance = await getBalance(tx, itemId, from.id);
  enoughAt(from, fromBalance, amount, item.unit);
  await setBalance(tx, itemId, from.id, fromBalance.minus(amount));
  const balanceAfter = item.quantity.minus(amount);
  await tx.inventoryItem.update({ where: { id: itemId }, data: { quantity: balanceAfter } });

  const movement = await tx.stockMovement.create({
    data: {
      itemId,
      type: kind,
      quantity: amount.negated(),
      balanceAfter,
      note,
      userId,
      submissionId,
      fromLocationId: from.id,
      bookingId: params.bookingId ?? null,
    },
  });
  await logActivity(tx, {
    userId,
    action: `stock.${kind.toLowerCase()}`,
    entityType: "InventoryItem",
    entityId: itemId,
    details: {
      item: item.name,
      unit: item.unit,
      change: amount.negated().toString(),
      before: item.quantity.toString(),
      after: balanceAfter.toString(),
      location: from.label,
      note,
    },
  });

  const gone = formatQuantityWithUnit(amount.toString(), item.unit);
  return {
    movement,
    duplicate: false,
    summary: `${gone} of ${item.name} written off as ${kind.toLowerCase()} from ${from.label}. ${formatQuantityWithUnit(balanceAfter, item.unit)} left in total.`,
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
    case "TRANSFERRED":
    case "LOST":
    case "DAMAGED":
      // These have their own functions with their own messages.
      return `${name}: ${left} in total.`;
  }
}
