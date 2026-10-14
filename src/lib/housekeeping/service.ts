import type { Prisma } from "@/generated/prisma/client";
import type { RoomStatus } from "@/generated/prisma/enums";
import { ActionError } from "@/lib/actions";
import { logActivity } from "@/lib/activity-log";
import { lockRoom } from "@/lib/booking/availability";
import { todayInResort, formatDateTime } from "@/lib/dates";
import { lockItem, recordStockMovement, transferStock, writeOffStock } from "@/lib/inventory/service";
import { loadFixedLocation, loadLocation } from "@/lib/inventory/locations";
import { formatQuantityWithUnit, toDecimal } from "@/lib/inventory/stock";
import {
  buildPrepLines,
  planInspection,
  planPrep,
  type InspectionEntry,
  type InspectionLine,
  type InspectionPlanLine,
  type ItemInfo,
  type PrepLine,
  type PrepPlan,
} from "./checklist";
import { resolvePar } from "./par";
import { ROOM_STATUS_LABELS } from "./labels";
import { roomTodo } from "./status";

type Tx = Prisma.TransactionClient;

/** Prep and inspection touch many items, each with a few round-trips to Neon. */
export const HOUSEKEEPING_TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 } as const;

/**
 * Lock order everywhere: reservation → room → items (by id). Completing a checklist takes the room, then every
 * item it will touch in id order, so two checklists can't deadlock on shared items. Both read stock only
 * after the item locks are held.
 */
async function lockItemsInOrder(tx: Tx, itemIds: Iterable<string>) {
  for (const id of [...new Set(itemIds)].sort()) await lockItem(tx, id);
}

type RoomRow = {
  id: string;
  name: string;
  status: RoomStatus;
  statusNote: string | null;
  dirtyCycle: number;
  inspectBookingId: string | null;
  roomTypeId: string;
  roomTypeName: string;
  locationId: string;
};

async function loadRoom(tx: Tx, roomId: string): Promise<RoomRow> {
  const room = await tx.room.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      name: true,
      status: true,
      statusNote: true,
      dirtyCycle: true,
      inspectBookingId: true,
      roomTypeId: true,
      roomType: { select: { name: true } },
      stockLocation: { select: { id: true } },
    },
  });
  if (!room) throw new ActionError("That room no longer exists.");
  if (!room.stockLocation) throw new ActionError(`${room.name} has no stock location. Contact an admin.`);
  return {
    id: room.id,
    name: room.name,
    status: room.status,
    statusNote: room.statusNote,
    dirtyCycle: room.dirtyCycle,
    inspectBookingId: room.inspectBookingId,
    roomTypeId: room.roomTypeId,
    roomTypeName: room.roomType.name,
    locationId: room.stockLocation.id,
  };
}

// ─── Prep ────────────────────────────────────────────────────────────────────

export type PrepChecklist = {
  room: RoomRow;
  /** The next confirmed arrival in this room, if any: its extras go on the list and the prep is linked to it. */
  booking: { id: string; reference: string; guestName: string; checkIn: Date } | null;
  lines: PrepLine[];
  /** Why the room can't be prepped right now; null when it can. */
  blocked: string | null;
};

/** What stock is needed to prep this room. With `lock`, takes the item locks first so the numbers hold. */
export async function loadPrepChecklist(tx: Tx, roomId: string, options: { lock?: boolean } = {}): Promise<PrepChecklist> {
  const room = await loadRoom(tx, roomId);
  const [typePar, overrides, booking] = await Promise.all([
    tx.parLine.findMany({ where: { roomTypeId: room.roomTypeId }, select: { itemId: true, quantity: true } }),
    tx.roomParOverride.findMany({ where: { roomId }, select: { itemId: true, quantity: true } }),
    tx.booking.findFirst({
      where: { roomId, status: "CONFIRMED", checkIn: { gte: todayInResort() } },
      orderBy: { checkIn: "asc" },
      select: { id: true, reservation: { select: { reference: true, guestName: true } }, checkIn: true },
    }),
  ]);
  const par = resolvePar(typePar, overrides);
  // Extras added for the linked booking before the room was prepared: they go on this checklist.
  const pending = booking ? await tx.bookingExtra.findMany({ where: { bookingId: booking.id, appliedAt: null }, select: { itemId: true, quantity: true } }) : [];
  const extras = new Map<string, Prisma.Decimal>();
  for (const e of pending) extras.set(e.itemId, (extras.get(e.itemId) ?? toDecimal(0)).plus(e.quantity));
  const itemIds = [...new Set([...par.keys(), ...extras.keys()])];
  if (options.lock) await lockItemsInOrder(tx, itemIds);

  const [itemRows, roomBalances, store] = await Promise.all([
    tx.inventoryItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, unit: true, isConsumable: true, isFixedInRoom: true, isActive: true, quantity: true },
    }),
    tx.stockBalance.findMany({ where: { locationId: room.locationId, itemId: { in: itemIds } }, select: { itemId: true, quantity: true } }),
    loadFixedLocation(tx, "STORE"),
  ]);
  const storeBalances = await tx.stockBalance.findMany({ where: { locationId: store.id, itemId: { in: itemIds } }, select: { itemId: true, quantity: true } });

  const items = new Map<string, ItemInfo>(itemRows.map((i) => [i.id, i]));
  const available = new Map<string, Prisma.Decimal>();
  for (const i of itemRows) if (i.isConsumable) available.set(i.id, i.quantity);
  for (const b of storeBalances) if (!items.get(b.itemId)?.isConsumable) available.set(b.itemId, b.quantity);

  const lines = buildPrepLines({
    par,
    extras,
    items,
    inRoom: new Map(roomBalances.map((b) => [b.itemId, b.quantity])),
    available,
  });
  const blocked = prepBlockedReason(room);
  return {
    room,
    booking: booking ? { id: booking.id, reference: booking.reservation.reference, guestName: booking.reservation.guestName, checkIn: booking.checkIn } : null,
    lines,
    blocked,
  };
}

function prepBlockedReason(room: Pick<RoomRow, "status" | "inspectBookingId" | "name">): string | null {
  const todo = roomTodo({ status: room.status, inspectPending: room.inspectBookingId !== null });
  if (todo === "PREP") return null;
  if (todo === "INSPECT") return `${room.name} was just checked out. Inspect it first, then prepare it.`;
  if (room.status === "OUT_OF_ORDER") return `${room.name} is out of order. Put it back to Dirty when it's fixed, then prepare it.`;
  return `${room.name} is ${ROOM_STATUS_LABELS[room.status].toLowerCase()}, so there's nothing to prepare.`;
}

type TaskSummary = { completedById: string; completedAt: Date; completedBy: { name: string } };

/** A repeat by the same person is a no-op; someone else gets told who did it and when. */
function alreadyDone(task: TaskSummary, userId: string, what: string) {
  if (task.completedById === userId) return { duplicate: true as const };
  throw new ActionError(`${task.completedBy.name} already completed this ${what} at ${formatDateTime(task.completedAt)}. Reload the page.`);
}

export type PrepResult = { duplicate: boolean; summary: string; shortfalls: PrepPlan["shortfalls"] };

/**
 * Completes a room prep in one transaction: reusables Store → Room, consumables recorded as USED, the
 * room becomes Ready, and a RoomTask row records what happened. The room lock plus the task's unique key
 * (room, kind, dirty cycle) mean two people completing the same checklist can't both succeed.
 */
export async function completePrep(
  tx: Tx,
  params: { roomId: string; cycle: number; userId: string; quantities: Record<string, string>; acknowledgeShortfall: boolean },
): Promise<PrepResult> {
  const { roomId, cycle, userId } = params;
  await lockRoom(tx, roomId);

  const existing = await tx.roomTask.findUnique({
    where: { roomId_kind_cycle: { roomId, kind: "PREP", cycle } },
    select: { completedById: true, completedAt: true, completedBy: { select: { name: true } } },
  });
  if (existing) {
    alreadyDone(existing, userId, "prep");
    return { duplicate: true, summary: "Already completed.", shortfalls: [] };
  }

  const checklist = await loadPrepChecklist(tx, roomId, { lock: true });
  const { room } = checklist;
  if (room.dirtyCycle !== cycle) throw new ActionError("This room was updated since you opened the list. Reload the page.");
  if (checklist.blocked) throw new ActionError(checklist.blocked);

  const plan = planPrep(checklist.lines, params.quantities, params.acknowledgeShortfall);
  const store = await loadFixedLocation(tx, "STORE");
  const bookingId = checklist.booking?.id ?? null;
  const note = `Room prep: ${room.name}`;

  for (const line of plan.lines) {
    if (!toDecimal(line.placed).greaterThan(0)) continue;
    if (line.isConsumable) {
      await recordStockMovement(tx, { itemId: line.itemId, userId, type: "USED", amount: line.placed, note, bookingId });
    } else {
      await transferStock(tx, { itemId: line.itemId, userId, fromLocationId: store.id, toLocationId: room.locationId, amount: line.placed, note, bookingId });
    }
  }

  // Every pending extra whose line was on the checklist has now been dealt with (placed, or short and flagged).
  if (bookingId) {
    const answered = plan.lines.map((l) => l.itemId);
    await tx.bookingExtra.updateMany({ where: { bookingId, appliedAt: null, itemId: { in: answered } }, data: { appliedAt: new Date() } });
  }

  await tx.roomTask.create({
    data: {
      roomId,
      kind: "PREP",
      cycle,
      bookingId,
      completedById: userId,
      lines: plan.lines.map((l) => ({ itemId: l.itemId, item: l.name, requested: l.requested, placed: l.placed })),
      shortfalls: plan.shortfalls.length ? plan.shortfalls.map((s) => ({ itemId: s.itemId, item: s.name, short: s.short })) : undefined,
    },
  });
  await tx.room.update({ where: { id: roomId }, data: { status: "READY", statusNote: null, statusChangedAt: new Date(), inspectBookingId: null } });
  await logActivity(tx, {
    userId,
    action: "room.prepCompleted",
    entityType: "Room",
    entityId: roomId,
    details: {
      room: room.name,
      ...(checklist.booking ? { reference: checklist.booking.reference, bookingId } : {}),
      placed: plan.lines.filter((l) => toDecimal(l.placed).greaterThan(0)).map((l) => `${l.name} ×${l.placed}`),
      ...(plan.shortfalls.length ? { short: plan.shortfalls.map((s) => `${s.name} ×${s.short}`) } : {}),
    },
  });
  await logActivity(tx, {
    userId,
    action: "room.statusChanged",
    entityType: "Room",
    entityId: roomId,
    details: { room: room.name, from: "DIRTY", to: "READY", reason: "prep" },
  });

  const short = plan.shortfalls.length ? ` Short: ${plan.shortfalls.map((s) => `${s.name} (${formatQuantityWithUnit(s.short, s.unit)})`).join(", ")}.` : "";
  return { duplicate: false, summary: `${room.name} is ready.${short}`, shortfalls: plan.shortfalls };
}

// ─── Inspection ──────────────────────────────────────────────────────────────

export type InspectionChecklist = {
  room: RoomRow;
  /** The stay that just ended. */
  booking: { id: string; reference: string; guestName: string } | null;
  lines: InspectionLine[];
  blocked: string | null;
};

export async function loadInspectionChecklist(tx: Tx, roomId: string, options: { lock?: boolean } = {}): Promise<InspectionChecklist> {
  const room = await loadRoom(tx, roomId);
  const booking = room.inspectBookingId
    ? await tx.booking.findUnique({ where: { id: room.inspectBookingId }, select: { id: true, reservation: { select: { reference: true, guestName: true } } } })
    : null;

  const held = await tx.stockBalance.findMany({
    where: { locationId: room.locationId, quantity: { gt: 0 }, item: { isConsumable: false, isActive: true } },
    select: { itemId: true },
  });
  if (options.lock) await lockItemsInOrder(tx, held.map((b) => b.itemId));
  const balances = await tx.stockBalance.findMany({
    where: { locationId: room.locationId, quantity: { gt: 0 }, item: { isConsumable: false, isActive: true } },
    select: { quantity: true, item: { select: { id: true, name: true, unit: true, isFixedInRoom: true } } },
  });
  const lines: InspectionLine[] = balances
    .map((b) => ({ itemId: b.item.id, name: b.item.name, unit: b.item.unit, isFixedInRoom: b.item.isFixedInRoom, expected: b.quantity.toString() }))
    .sort((a, b) => a.name.localeCompare(b.name));

  let blocked: string | null = null;
  if (room.status !== "DIRTY" || !room.inspectBookingId) blocked = `${room.name} has no checked-out stay waiting to be inspected.`;
  return {
    room,
    booking: booking ? { id: booking.id, reference: booking.reservation.reference, guestName: booking.reservation.guestName } : null,
    lines,
    blocked,
  };
}

export type InspectionResult = { duplicate: boolean; summary: string; plan: InspectionPlanLine[] };

/**
 * Completes a checkout inspection in one transaction: anything missing is written off as lost/damaged against
 * the stay, counted non-fixed items go Room → Laundry, fixed items stay. The room stays Dirty until the next prep.
 */
export async function completeInspection(
  tx: Tx,
  params: { roomId: string; cycle: number; userId: string; entries: Record<string, InspectionEntry> },
): Promise<InspectionResult> {
  const { roomId, cycle, userId } = params;
  await lockRoom(tx, roomId);

  const existing = await tx.roomTask.findUnique({
    where: { roomId_kind_cycle: { roomId, kind: "INSPECTION", cycle } },
    select: { completedById: true, completedAt: true, completedBy: { select: { name: true } } },
  });
  if (existing) {
    alreadyDone(existing, userId, "inspection");
    return { duplicate: true, summary: "Already completed.", plan: [] };
  }

  const checklist = await loadInspectionChecklist(tx, roomId, { lock: true });
  const { room } = checklist;
  if (room.dirtyCycle !== cycle) throw new ActionError("This room was updated since you opened the list. Reload the page.");
  if (checklist.blocked || !checklist.booking) throw new ActionError(checklist.blocked ?? "That stay no longer exists.");

  const plan = planInspection(checklist.lines, params.entries);
  const laundry = await loadFixedLocation(tx, "LAUNDRY");
  const bookingId = checklist.booking.id;
  const where = await loadLocation(tx, room.locationId);

  for (const line of plan) {
    if (line.kind && toDecimal(line.missing).greaterThan(0)) {
      await writeOffStock(tx, { itemId: line.itemId, userId, kind: line.kind, fromLocationId: where.id, amount: line.missing, note: line.note, bookingId });
    }
    if (toDecimal(line.toLaundry).greaterThan(0)) {
      await transferStock(tx, { itemId: line.itemId, userId, fromLocationId: where.id, toLocationId: laundry.id, amount: line.toLaundry, note: `Checkout inspection: ${room.name}`, bookingId });
    }
  }

  const missing = plan.filter((l) => toDecimal(l.missing).greaterThan(0));
  await tx.roomTask.create({
    data: {
      roomId,
      kind: "INSPECTION",
      cycle,
      bookingId,
      completedById: userId,
      lines: plan.map((l) => ({ itemId: l.itemId, item: l.name, expected: l.expected, counted: l.counted })),
      shortfalls: missing.length ? missing.map((l) => ({ itemId: l.itemId, item: l.name, missing: l.missing, kind: l.kind, note: l.note })) : undefined,
    },
  });
  await tx.room.update({ where: { id: roomId }, data: { inspectBookingId: null } });
  await logActivity(tx, {
    userId,
    action: "room.inspectionCompleted",
    entityType: "Room",
    entityId: roomId,
    details: {
      room: room.name,
      reference: checklist.booking.reference,
      bookingId,
      toLaundry: plan.filter((l) => toDecimal(l.toLaundry).greaterThan(0)).map((l) => `${l.name} ×${l.toLaundry}`),
      ...(missing.length ? { missing: missing.map((l) => `${l.name} ×${l.missing} (${l.kind?.toLowerCase()}: ${l.note})`) } : {}),
    },
  });

  const lost = missing.length ? ` Written off: ${missing.map((l) => `${l.name} (${formatQuantityWithUnit(l.missing, l.unit)})`).join(", ")}.` : "";
  return { duplicate: false, summary: `${room.name} inspected. It stays Dirty until it is prepared.${lost}`, plan };
}

/**
 * Admin override: marks a checkout inspection as skipped, with a reason. The stay's room stays Dirty and can
 * be prepared. Takes the same room lock and writes the same (room, INSPECTION, cycle) row as a real
 * inspection, so a skip and an inspection can't both happen. No stock moves.
 */
export async function skipInspection(
  tx: Tx,
  params: { roomId: string; cycle: number; userId: string; reason: string },
): Promise<{ summary: string }> {
  const { roomId, cycle, userId } = params;
  const reason = params.reason.trim();
  if (!reason) throw new ActionError("Say why the inspection is being skipped.", { reason: "Required." });
  await lockRoom(tx, roomId);

  const existing = await tx.roomTask.findUnique({
    where: { roomId_kind_cycle: { roomId, kind: "INSPECTION", cycle } },
    select: { completedBy: { select: { name: true } }, completedAt: true },
  });
  if (existing) throw new ActionError(`${existing.completedBy.name} already finished this inspection at ${formatDateTime(existing.completedAt)}. Reload the page.`);

  const room = await loadRoom(tx, roomId);
  if (room.dirtyCycle !== cycle) throw new ActionError("This room was updated since you opened the page. Reload the page.");
  if (room.status !== "DIRTY" || !room.inspectBookingId) throw new ActionError(`${room.name} has no checked-out stay waiting to be inspected.`);

  await tx.roomTask.create({
    data: { roomId, kind: "INSPECTION", cycle, bookingId: room.inspectBookingId, completedById: userId, lines: { skipped: true, reason } },
  });
  await tx.room.update({ where: { id: roomId }, data: { inspectBookingId: null } });
  await logActivity(tx, {
    userId,
    action: "room.inspectionSkipped",
    entityType: "Room",
    entityId: roomId,
    details: { room: room.name, bookingId: room.inspectBookingId, reason },
  });
  return { summary: `Inspection skipped for ${room.name}. It is Dirty and ready to be prepared.` };
}
