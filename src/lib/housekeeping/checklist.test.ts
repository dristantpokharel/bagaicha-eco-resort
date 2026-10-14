import { describe, expect, it, vi } from "vitest";
// lib/actions pulls in Auth.js through the session module; the rules under test never use it.
vi.mock("@/lib/auth/session", () => ({ AuthorizationError: class extends Error {} }));

import { ActionError } from "@/lib/actions";
import { buildPrepLines, planInspection, planPrep, type InspectionLine, type ItemInfo } from "./checklist";
import { resolvePar } from "./par";

const item = (id: string, over: Partial<ItemInfo> = {}): ItemInfo => ({ id, name: id, unit: "pcs", isConsumable: false, isFixedInRoom: false, isActive: true, ...over });
const items = new Map([
  ["towel", item("towel")],
  ["kettle", item("kettle", { isFixedInRoom: true })],
  ["soap", item("soap", { isConsumable: true })],
  ["old", item("old", { isActive: false })],
]);

describe("resolvePar", () => {
  it("applies room overrides: replace, remove with 0, or add", () => {
    const par = resolvePar(
      [{ itemId: "towel", quantity: "2" }, { itemId: "kettle", quantity: "1" }],
      [{ itemId: "towel", quantity: "4" }, { itemId: "kettle", quantity: "0" }, { itemId: "soap", quantity: "2" }],
    );
    expect(Object.fromEntries([...par].map(([k, v]) => [k, v.toString()]))).toEqual({ towel: "4", soap: "2" });
  });
});

describe("buildPrepLines", () => {
  const base = {
    par: new Map([["towel", "4"], ["kettle", "1"], ["soap", "2"], ["old", "1"]]),
    items,
    inRoom: new Map([["towel", "1"], ["kettle", "1"]]),
    available: new Map([["towel", "10"], ["soap", "30"]]),
  };

  it("is par minus what is in the room, skipping stocked and archived items", () => {
    const lines = buildPrepLines(base);
    expect(lines.map((l) => [l.itemId, l.need])).toEqual([["soap", "2"], ["towel", "3"]]);
  });

  it("places the full par of consumables whatever the room holds", () => {
    const lines = buildPrepLines({ ...base, inRoom: new Map([["soap", "5"]]) });
    expect(lines.find((l) => l.itemId === "soap")?.need).toBe("2");
  });

  it("adds booking extras on top of par", () => {
    const lines = buildPrepLines({ ...base, extras: new Map([["towel", "2"]]) });
    expect(lines.find((l) => l.itemId === "towel")?.need).toBe("5");
  });
});

describe("planPrep", () => {
  const lines = buildPrepLines({
    par: new Map([["towel", "4"], ["soap", "2"]]),
    items,
    inRoom: new Map(),
    available: new Map([["towel", "3"], ["soap", "30"]]),
  });

  it("places everything the store covers", () => {
    const plan = planPrep(lines, { towel: "3", soap: "2" }, false);
    expect(plan.shortfalls).toEqual([]);
    expect(plan.lines.map((l) => [l.itemId, l.placed])).toEqual([["soap", "2"], ["towel", "3"]]);
  });

  it("lets staff lower a line, including a consumable to 0, without calling it a shortfall", () => {
    const plan = planPrep(lines, { towel: "2", soap: "0" }, false);
    expect(plan.shortfalls).toEqual([]);
    expect(plan.lines.find((l) => l.itemId === "soap")?.placed).toBe("0");
  });

  it("flags a store shortfall and refuses it until confirmed", () => {
    expect(() => planPrep(lines, { towel: "4", soap: "2" }, false)).toThrow(/short on towel/);
    const plan = planPrep(lines, { towel: "4", soap: "2" }, true);
    expect(plan.shortfalls.map((s) => [s.itemId, s.placed, s.short])).toEqual([["towel", "3", "1"]]);
  });

  it("rejects stale or tampered submissions", () => {
    expect(() => planPrep(lines, { towel: "4" }, true)).toThrow(/changed/);
    expect(() => planPrep(lines, { towel: "4", soap: "2", ghost: "1" }, true)).toThrow(/changed/);
    expect(() => planPrep(lines, { towel: "5", soap: "2" }, true)).toThrow(ActionError);
    expect(() => planPrep(lines, { towel: "-1", soap: "2" }, true)).toThrow(ActionError);
    expect(() => planPrep(lines, { towel: "1.5", soap: "2" }, true)).toThrow(ActionError);
  });
});

describe("planInspection", () => {
  const lines: InspectionLine[] = [
    { itemId: "towel", name: "Towel", unit: "pcs", isFixedInRoom: false, expected: "3" },
    { itemId: "kettle", name: "Kettle", unit: "pcs", isFixedInRoom: true, expected: "1" },
  ];

  it("sends counted non-fixed items to the laundry and leaves fixed ones", () => {
    const plan = planInspection(lines, { towel: { counted: "3" }, kettle: { counted: "1" } });
    expect(plan.map((l) => [l.itemId, l.toLaundry, l.missing])).toEqual([["towel", "3", "0"], ["kettle", "0", "0"]]);
  });

  it("requires kind and note for anything missing", () => {
    expect(() => planInspection(lines, { towel: { counted: "2" }, kettle: { counted: "1" } })).toThrow(ActionError);
    expect(() => planInspection(lines, { towel: { counted: "2", kind: "LOST" }, kettle: { counted: "1" } })).toThrow(ActionError);
    const plan = planInspection(lines, { towel: { counted: "2", kind: "LOST", note: " guest took it " }, kettle: { counted: "1" } });
    expect(plan[0]).toMatchObject({ missing: "1", kind: "LOST", note: "guest took it", toLaundry: "2" });
  });

  it("treats a missing fixed item as lost/damaged too", () => {
    const plan = planInspection(lines, { towel: { counted: "3" }, kettle: { counted: "0", kind: "DAMAGED", note: "cracked" } });
    expect(plan[1]).toMatchObject({ missing: "1", kind: "DAMAGED", toLaundry: "0" });
  });

  it("won't take a count above what the system holds, or a blank count", () => {
    expect(() => planInspection(lines, { towel: { counted: "4" }, kettle: { counted: "1" } })).toThrow(ActionError);
    expect(() => planInspection(lines, { towel: { counted: "" }, kettle: { counted: "1" } })).toThrow(ActionError);
  });

  it("rejects an incomplete or foreign submission", () => {
    expect(() => planInspection(lines, { towel: { counted: "3" } })).toThrow(/changed/);
    expect(() => planInspection(lines, { towel: { counted: "3" }, kettle: { counted: "1" }, x: { counted: "1" } })).toThrow(/changed/);
  });
});
