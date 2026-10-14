import { toDecimal, type Quantity } from "./stock";

type Decimal = ReturnType<typeof toDecimal>;

// ─── Rooms × items grid ──────────────────────────────────────────────────────

export type GridItem = { id: string; name: string; unit: string };
export type GridRoom = { id: string; name: string; par: ReadonlyMap<string, Quantity>; have: ReadonlyMap<string, Quantity> };
export type CellState = "short" | "over" | "ok";
export type GridCell = { have: string; par: string; state: CellState };

/**
 * Reusable items against each room's par. A cell exists when the room has the item or should have it. "short" is
 * below par, "over" is above it (including an item the room shouldn't hold at all).
 */
export function buildGrid(rooms: readonly GridRoom[], items: readonly GridItem[]) {
  const rows = rooms.map((room) => {
    const cells: Record<string, GridCell> = {};
    for (const item of items) {
      const par = toDecimal(room.par.get(item.id) ?? 0);
      const have = toDecimal(room.have.get(item.id) ?? 0);
      if (par.isZero() && have.isZero()) continue;
      cells[item.id] = { have: have.toString(), par: par.toString(), state: have.lessThan(par) ? "short" : have.greaterThan(par) ? "over" : "ok" };
    }
    return { roomId: room.id, roomName: room.name, cells };
  });
  const used = new Set(rows.flatMap((r) => Object.keys(r.cells)));
  const columns = items.filter((i) => used.has(i.id));
  const shortCells = rows.reduce((n, r) => n + Object.values(r.cells).filter((c) => c.state === "short").length, 0);
  const overCells = rows.reduce((n, r) => n + Object.values(r.cells).filter((c) => c.state === "over").length, 0);
  return { columns, rows, shortCells, overCells };
}

// ─── Lost / damaged ──────────────────────────────────────────────────────────

export type LossRow = { itemId: string; name: string; unit: string; type: "LOST" | "DAMAGED"; quantity: Quantity; unitCostNpr: number | null };

/** Totals for the month. Cost is only counted for items with a known unit cost; the rest are counted separately. */
export function summarizeLosses(rows: readonly LossRow[]) {
  const byItem = new Map<string, { itemId: string; name: string; unit: string; lost: Decimal; damaged: Decimal; unitCostNpr: number | null }>();
  for (const row of rows) {
    const entry = byItem.get(row.itemId) ?? { itemId: row.itemId, name: row.name, unit: row.unit, lost: toDecimal(0), damaged: toDecimal(0), unitCostNpr: row.unitCostNpr };
    const amount = toDecimal(row.quantity).abs();
    if (row.type === "LOST") entry.lost = entry.lost.plus(amount);
    else entry.damaged = entry.damaged.plus(amount);
    byItem.set(row.itemId, entry);
  }
  const items = [...byItem.values()]
    .map((e) => {
      const total = e.lost.plus(e.damaged);
      return {
        itemId: e.itemId,
        name: e.name,
        unit: e.unit,
        lost: e.lost.toString(),
        damaged: e.damaged.toString(),
        unitCostNpr: e.unitCostNpr,
        costNpr: e.unitCostNpr === null ? null : Math.round(total.times(e.unitCostNpr).toNumber()),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    items,
    totalCostNpr: items.reduce((sum, i) => sum + (i.costNpr ?? 0), 0),
    itemsWithoutCost: items.filter((i) => i.costNpr === null).length,
  };
}

// ─── To buy ──────────────────────────────────────────────────────────────────

export type BuyItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  isConsumable: boolean;
  isFixedInRoom: boolean;
  /** Total owned (consumables: the one total; reusables: store + laundry + rooms). */
  quantity: Quantity;
  lowStockThreshold: Quantity;
};

export type BuyRoom = {
  id: string;
  status: "DIRTY" | "READY" | "OCCUPIED" | "OUT_OF_ORDER";
  par: ReadonlyMap<string, Quantity>;
  /** Reusables currently in the room. */
  have: ReadonlyMap<string, Quantity>;
  /** The room was prepped with a store shortfall and hasn't been topped up since. */
  flaggedShort: boolean;
};

/** Pending extras for an arrival in the next days, by room. */
export type BuyArrival = { roomId: string; extras: ReadonlyMap<string, Quantity> };

export type ToBuyRow = {
  itemId: string;
  name: string;
  category: string;
  unit: string;
  have: string;
  alertAt: string;
  /** What arrivals and short rooms need that the store and laundry can't cover. "0" when none. */
  arrivalsShort: string;
  belowThreshold: boolean;
  /** At least this much to buy. */
  buy: string;
};

/**
 * What to buy. Two reasons, both shown:
 *  1. An item at or below its low-stock threshold (a threshold of 0 never alerts).
 *  2. Rooms that arrivals in the coming days need, or that were left short at prep, which the Store and Laundry
 *     can't cover. A Dirty or Occupied room will have its linen collected first, so its movable reusables count
 *     as empty; fixed items stay. Consumables are placed in full for every arrival.
 * "Buy at least" is the larger of the two gaps, so it is never an invented target.
 */
export function computeToBuy(params: {
  items: readonly BuyItem[];
  rooms: readonly BuyRoom[];
  arrivals: readonly BuyArrival[];
  store: ReadonlyMap<string, Quantity>;
  laundry: ReadonlyMap<string, Quantity>;
}): ToBuyRow[] {
  const { items, rooms, arrivals, store, laundry } = params;
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const demand = new Map<string, Decimal>();
  const add = (itemId: string, amount: Decimal) => demand.set(itemId, (demand.get(itemId) ?? toDecimal(0)).plus(amount));

  // Reusables: each room in scope once, however many arrivals it has.
  const itemById = new Map(items.map((i) => [i.id, i]));
  const scope = new Set<string>(rooms.filter((r) => r.flaggedShort).map((r) => r.id));
  for (const a of arrivals) scope.add(a.roomId);
  for (const roomId of scope) {
    const room = roomById.get(roomId);
    if (!room || room.status === "OUT_OF_ORDER") continue;
    const extras = new Map<string, Decimal>();
    for (const a of arrivals) {
      if (a.roomId !== roomId) continue;
      for (const [itemId, q] of a.extras) extras.set(itemId, (extras.get(itemId) ?? toDecimal(0)).plus(q));
    }
    const wanted = new Map<string, Decimal>();
    for (const [itemId, q] of room.par) wanted.set(itemId, toDecimal(q));
    for (const [itemId, q] of extras) wanted.set(itemId, (wanted.get(itemId) ?? toDecimal(0)).plus(q));
    for (const [itemId, want] of wanted) {
      const item = itemById.get(itemId);
      if (!item || item.isConsumable) continue;
      const leaving = (room.status === "DIRTY" || room.status === "OCCUPIED") && !item.isFixedInRoom;
      const inRoom = leaving ? toDecimal(0) : toDecimal(room.have.get(itemId) ?? 0);
      if (want.greaterThan(inRoom)) add(itemId, want.minus(inRoom));
    }
  }

  // Consumables: full par plus extras for each arrival.
  for (const a of arrivals) {
    const room = roomById.get(a.roomId);
    if (!room) continue;
    const wanted = new Map<string, Decimal>();
    for (const [itemId, q] of room.par) wanted.set(itemId, toDecimal(q));
    for (const [itemId, q] of a.extras) wanted.set(itemId, (wanted.get(itemId) ?? toDecimal(0)).plus(q));
    for (const [itemId, want] of wanted) if (itemById.get(itemId)?.isConsumable) add(itemId, want);
  }

  const rowsOut: ToBuyRow[] = [];
  for (const item of items) {
    const threshold = toDecimal(item.lowStockThreshold);
    const owned = toDecimal(item.quantity);
    const belowThreshold = threshold.greaterThan(0) && owned.lessThanOrEqualTo(threshold);
    const needed = demand.get(item.id) ?? toDecimal(0);
    const onHand = item.isConsumable ? owned : toDecimal(store.get(item.id) ?? 0).plus(laundry.get(item.id) ?? 0);
    const arrivalsShort = needed.greaterThan(onHand) ? needed.minus(onHand) : toDecimal(0);
    if (!belowThreshold && arrivalsShort.isZero()) continue;
    const thresholdGap = belowThreshold ? threshold.minus(owned) : toDecimal(0);
    // A consumable that arrivals will use up has to stay above its alert level afterwards.
    const buy = item.isConsumable && belowThreshold ? maxOf(arrivalsShort, threshold.minus(owned).plus(needed)) : maxOf(arrivalsShort, thresholdGap);
    rowsOut.push({
      itemId: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      have: owned.toString(),
      alertAt: threshold.toString(),
      arrivalsShort: arrivalsShort.toString(),
      belowThreshold,
      buy: buy.toString(),
    });
  }
  return rowsOut.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

function maxOf(a: Decimal, b: Decimal) {
  return a.greaterThan(b) ? a : b;
}
