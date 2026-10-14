import type { Prisma } from "@/generated/prisma/client";
import { ActionError } from "@/lib/actions";
import { logActivity } from "@/lib/activity-log";
import { assertAmountFitsUnit, toDecimal } from "@/lib/inventory/stock";
import { planRoomOverrides, planTypeParSave, resolvePar } from "./par";

type Tx = Prisma.TransactionClient;

export const PAR_MAX_QUANTITY = 999;

export type ParScope = { kind: "roomType"; roomTypeId: string } | { kind: "room"; roomId: string };

/** Checks the desired list against the items table and returns it as item → quantity. */
async function validateDesired(tx: Tx, desired: Readonly<Record<string, string>>, alreadyAllowed: ReadonlySet<string>) {
  const ids = Object.keys(desired);
  const items = await tx.inventoryItem.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, unit: true, isActive: true } });
  const byId = new Map(items.map((i) => [i.id, i]));
  const out = new Map<string, string>();
  for (const [itemId, raw] of Object.entries(desired)) {
    const item = byId.get(itemId);
    const fail = (message: string): never => {
      throw new ActionError("Please fix the highlighted fields.", { [itemId]: message });
    };
    if (!item) return fail("That item no longer exists.");
    if (!item.isActive && !alreadyAllowed.has(itemId)) return fail(`${item.name} is archived.`);
    let quantity;
    try {
      quantity = toDecimal(raw.trim());
    } catch {
      return fail("Enter a number.");
    }
    if (quantity.isNaN() || quantity.lessThanOrEqualTo(0)) return fail("Enter an amount above zero (remove the row instead of using 0).");
    if (quantity.greaterThan(PAR_MAX_QUANTITY)) return fail(`At most ${PAR_MAX_QUANTITY}.`);
    assertAmountFitsUnit(quantity, item.unit, itemId);
    out.set(itemId, quantity.toString());
  }
  return { desired: out, names: new Map(items.map((i) => [i.id, i.name])) };
}

/** Saves a par list: the whole list of a room type, or one room's differences from its type. Logged. */
export async function savePar(tx: Tx, params: { scope: ParScope; desired: Record<string, string>; userId: string }) {
  const { scope, userId } = params;
  const names = (ids: string[], all: Map<string, string>) => ids.map((id) => all.get(id) ?? id);

  if (scope.kind === "roomType") {
    const roomType = await tx.roomType.findUnique({ where: { id: scope.roomTypeId }, select: { id: true, name: true } });
    if (!roomType) throw new ActionError("That room type no longer exists.");
    const currentRows = await tx.parLine.findMany({ where: { roomTypeId: roomType.id }, select: { itemId: true, quantity: true } });
    const current = new Map(currentRows.map((r) => [r.itemId, r.quantity]));
    const checked = (await validateDesired(tx, params.desired, new Set(current.keys())));
    const plan = planTypeParSave(checked.desired, current);
    if (!plan.upserts.length && !plan.deletes.length) return { changed: false, message: "No changes to save." };

    for (const change of plan.upserts) {
      await tx.parLine.upsert({
        where: { roomTypeId_itemId: { roomTypeId: roomType.id, itemId: change.itemId } },
        update: { quantity: change.quantity },
        create: { roomTypeId: roomType.id, itemId: change.itemId, quantity: change.quantity },
      });
    }
    if (plan.deletes.length) await tx.parLine.deleteMany({ where: { roomTypeId: roomType.id, itemId: { in: plan.deletes } } });

    const removedItems = plan.deletes.length ? await tx.inventoryItem.findMany({ where: { id: { in: plan.deletes } }, select: { id: true, name: true } }) : [];
    const allNames = new Map([...checked.names, ...removedItems.map((i) => [i.id, i.name] as const)]);
    await logActivity(tx, {
      userId,
      action: "par.updated",
      entityType: "RoomType",
      entityId: roomType.id,
      details: {
        roomType: roomType.name,
        set: plan.upserts.map((u) => `${allNames.get(u.itemId)} ×${u.quantity}`),
        removed: names(plan.deletes, allNames),
      },
    });
    return { changed: true, message: `Par list for ${roomType.name} saved.` };
  }

  const room = await tx.room.findUnique({ where: { id: scope.roomId }, select: { id: true, name: true, roomTypeId: true } });
  if (!room) throw new ActionError("That room no longer exists.");
  const [typeRows, overrideRows] = await Promise.all([
    tx.parLine.findMany({ where: { roomTypeId: room.roomTypeId }, select: { itemId: true, quantity: true } }),
    tx.roomParOverride.findMany({ where: { roomId: room.id }, select: { itemId: true, quantity: true } }),
  ]);
  const typePar = new Map(typeRows.map((r) => [r.itemId, r.quantity]));
  const overrides = new Map(overrideRows.map((r) => [r.itemId, r.quantity]));
  const effective = resolvePar(typeRows, overrideRows);
  const checked = (await validateDesired(tx, params.desired, new Set(effective.keys())));
  const plan = planRoomOverrides(checked.desired, typePar, overrides);
  if (!plan.upserts.length && !plan.deletes.length) return { changed: false, message: "No changes to save." };

  for (const change of plan.upserts) {
    await tx.roomParOverride.upsert({
      where: { roomId_itemId: { roomId: room.id, itemId: change.itemId } },
      update: { quantity: change.quantity },
      create: { roomId: room.id, itemId: change.itemId, quantity: change.quantity },
    });
  }
  if (plan.deletes.length) await tx.roomParOverride.deleteMany({ where: { roomId: room.id, itemId: { in: plan.deletes } } });

  const involved = await tx.inventoryItem.findMany({
    where: { id: { in: [...plan.upserts.map((u) => u.itemId), ...plan.deletes] } },
    select: { id: true, name: true },
  });
  const allNames = new Map(involved.map((i) => [i.id, i.name]));
  await logActivity(tx, {
    userId,
    action: "par.roomOverridesUpdated",
    entityType: "Room",
    entityId: room.id,
    details: { room: room.name, set: plan.upserts.map((u) => `${allNames.get(u.itemId)} ×${u.quantity}`), cleared: names(plan.deletes, allNames) },
  });
  return { changed: true, message: `Par list for ${room.name} saved.` };
}
