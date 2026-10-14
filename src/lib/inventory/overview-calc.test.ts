import { describe, expect, it, vi } from "vitest";
// stock.ts pulls in Auth.js through lib/actions; these rules never use it.
vi.mock("@/lib/auth/session", () => ({ AuthorizationError: class extends Error {} }));

import { buildGrid, computeToBuy, summarizeLosses, type BuyItem, type BuyRoom } from "./overview-calc";

const m = (entries: Record<string, string>) => new Map(Object.entries(entries));

describe("buildGrid", () => {
  const items = [
    { id: "towel", name: "Towel", unit: "pcs" },
    { id: "kettle", name: "Kettle", unit: "pcs" },
    { id: "robe", name: "Robe", unit: "pcs" },
  ];
  const grid = buildGrid(
    [
      { id: "r1", name: "101", par: m({ towel: "4", kettle: "1" }), have: m({ towel: "4", kettle: "1" }) },
      { id: "r2", name: "102", par: m({ towel: "4", kettle: "1" }), have: m({ towel: "2", kettle: "1" }) },
      { id: "r3", name: "103", par: m({ towel: "4" }), have: m({ towel: "5", robe: "1" }) },
    ],
    items,
  );

  it("marks short, over and ok against par", () => {
    expect(grid.rows[0].cells.towel.state).toBe("ok");
    expect(grid.rows[1].cells.towel).toEqual({ have: "2", par: "4", state: "short" });
    expect(grid.rows[2].cells.towel.state).toBe("over");
  });

  it("flags an item a room holds but shouldn't as over, and leaves out empty cells", () => {
    expect(grid.rows[2].cells.robe).toEqual({ have: "1", par: "0", state: "over" });
    expect(grid.rows[2].cells.kettle).toBeUndefined();
    expect(grid.shortCells).toBe(1);
    expect(grid.overCells).toBe(2);
  });

  it("drops items nobody has or needs", () => {
    expect(buildGrid([{ id: "r", name: "1", par: m({}), have: m({}) }], items).columns).toEqual([]);
  });
});

describe("summarizeLosses", () => {
  it("adds lost and damaged by item, and costs only items with a known unit cost", () => {
    const s = summarizeLosses([
      { itemId: "glass", name: "Glass", unit: "pcs", type: "LOST", quantity: "-2", unitCostNpr: 150 },
      { itemId: "glass", name: "Glass", unit: "pcs", type: "DAMAGED", quantity: "1", unitCostNpr: 150 },
      { itemId: "towel", name: "Towel", unit: "pcs", type: "LOST", quantity: "1", unitCostNpr: null },
    ]);
    expect(s.items.find((i) => i.itemId === "glass")).toMatchObject({ lost: "2", damaged: "1", costNpr: 450 });
    expect(s.items.find((i) => i.itemId === "towel")?.costNpr).toBeNull();
    expect(s.totalCostNpr).toBe(450);
    expect(s.itemsWithoutCost).toBe(1);
  });

  it("is empty with nothing lost", () => {
    expect(summarizeLosses([])).toEqual({ items: [], totalCostNpr: 0, itemsWithoutCost: 0 });
  });
});

describe("computeToBuy", () => {
  const item = (over: Partial<BuyItem> & { id: string }): BuyItem => ({
    name: over.id,
    category: "Linen",
    unit: "pcs",
    isConsumable: false,
    isFixedInRoom: false,
    quantity: "10",
    lowStockThreshold: "0",
    ...over,
  });
  const room = (over: Partial<BuyRoom> & { id: string }): BuyRoom => ({ status: "READY", par: m({}), have: m({}), flaggedShort: false, ...over });
  const none = { rooms: [], arrivals: [], store: m({}), laundry: m({}) };

  it("lists nothing when stock is fine and nobody arrives", () => {
    expect(computeToBuy({ ...none, items: [item({ id: "towel", lowStockThreshold: "5" })] })).toEqual([]);
  });

  it("lists items at or below their threshold, and ignores a threshold of 0", () => {
    const rows = computeToBuy({
      ...none,
      items: [item({ id: "soap", isConsumable: true, quantity: "3", lowStockThreshold: "5" }), item({ id: "mat", quantity: "0", lowStockThreshold: "0" })],
    });
    expect(rows).toMatchObject([{ itemId: "soap", belowThreshold: true, have: "3", alertAt: "5", arrivalsShort: "0", buy: "2" }]);
  });

  it("counts par shortfalls for arrivals that the store and laundry can't cover", () => {
    const rows = computeToBuy({
      items: [item({ id: "towel", quantity: "8" })],
      rooms: [room({ id: "a", par: m({ towel: "4" }), have: m({ towel: "1" }) }), room({ id: "b", par: m({ towel: "4" }), have: m({}) })],
      arrivals: [
        { roomId: "a", extras: m({}) },
        { roomId: "b", extras: m({ towel: "1" }) },
      ],
      store: m({ towel: "4" }),
      laundry: m({ towel: "1" }),
    });
    // a needs 3, b needs 5 → 8; store + laundry cover 5.
    expect(rows).toMatchObject([{ itemId: "towel", arrivalsShort: "3", buy: "3", belowThreshold: false }]);
  });

  it("treats the linen in a Dirty or Occupied room as leaving, but fixed items as staying", () => {
    const rows = computeToBuy({
      items: [item({ id: "towel" }), item({ id: "kettle", isFixedInRoom: true })],
      rooms: [room({ id: "a", status: "DIRTY", par: m({ towel: "2", kettle: "1" }), have: m({ towel: "2", kettle: "1" }) })],
      arrivals: [{ roomId: "a", extras: m({}) }],
      store: m({}),
      laundry: m({}),
    });
    expect(rows.map((r) => [r.itemId, r.arrivalsShort])).toEqual([["towel", "2"]]);
  });

  it("counts a room once for reusables however many arrivals it has, but consumables for each", () => {
    const rows = computeToBuy({
      items: [item({ id: "towel" }), item({ id: "soap", isConsumable: true, quantity: "3" })],
      rooms: [room({ id: "a", par: m({ towel: "2", soap: "2" }), have: m({}) })],
      arrivals: [
        { roomId: "a", extras: m({}) },
        { roomId: "a", extras: m({}) },
      ],
      store: m({}),
      laundry: m({}),
    });
    expect(rows.find((r) => r.itemId === "towel")?.arrivalsShort).toBe("2");
    expect(rows.find((r) => r.itemId === "soap")?.arrivalsShort).toBe("1");
  });

  it("includes rooms left short at prep even with no arrival, and skips out-of-order rooms", () => {
    const rows = computeToBuy({
      items: [item({ id: "towel" })],
      rooms: [
        room({ id: "a", par: m({ towel: "4" }), have: m({ towel: "3" }), flaggedShort: true }),
        room({ id: "b", status: "OUT_OF_ORDER", par: m({ towel: "4" }), have: m({}), flaggedShort: true }),
      ],
      arrivals: [],
      store: m({}),
      laundry: m({}),
    });
    expect(rows).toMatchObject([{ itemId: "towel", arrivalsShort: "1", buy: "1" }]);
  });

  it("buys the larger of the two gaps, and keeps a consumable above its alert level after arrivals use it", () => {
    const rows = computeToBuy({
      items: [item({ id: "soap", isConsumable: true, quantity: "4", lowStockThreshold: "5" })],
      rooms: [room({ id: "a", par: m({ soap: "2" }) })],
      arrivals: [{ roomId: "a", extras: m({}) }],
      store: m({}),
      laundry: m({}),
    });
    // short for arrivals: 0 (4 ≥ 2). Alert level: 5 - 4 + 2 used = 3.
    expect(rows).toMatchObject([{ itemId: "soap", arrivalsShort: "0", belowThreshold: true, buy: "3" }]);
  });
});
