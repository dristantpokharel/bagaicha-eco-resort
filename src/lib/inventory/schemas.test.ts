import { describe, expect, it } from "vitest";
import { createItemSchema, recordMovementSchema, transferStockSchema, updateItemSchema, writeOffStockSchema } from "./schemas";

const item = { name: "Basmati rice", category: "Kitchen", unit: "kg" };

describe("createItemSchema", () => {
  it("defaults blank threshold, opening stock, cost and supplier", () => {
    const r = createItemSchema.parse({ ...item, lowStockThreshold: "", openingQuantity: "", unitCostNpr: "", supplier: "" });
    expect(r).toMatchObject({ lowStockThreshold: "0", openingQuantity: "0", unitCostNpr: null, supplier: null });
  });

  it("accepts decimals for kg and L, with commas", () => {
    const r = createItemSchema.parse({ ...item, lowStockThreshold: "2.5", openingQuantity: "1,250.25" });
    expect(r.openingQuantity).toBe("1250.25");
  });

  it("rejects more than 2 decimals and negatives", () => {
    expect(createItemSchema.safeParse({ ...item, openingQuantity: "1.234" }).success).toBe(false);
    expect(createItemSchema.safeParse({ ...item, lowStockThreshold: "-1" }).success).toBe(false);
    expect(createItemSchema.safeParse({ ...item, openingQuantity: "abc" }).success).toBe(false);
  });

  it("rejects fractions for whole-number units", () => {
    for (const unit of ["pcs", "box", "pack"]) {
      const r = createItemSchema.safeParse({ ...item, unit, lowStockThreshold: "1.5" });
      expect(r.success).toBe(false);
    }
    expect(createItemSchema.safeParse({ ...item, unit: "pcs", lowStockThreshold: "6", openingQuantity: "24" }).success).toBe(true);
  });

  it("rejects an unknown unit and a bad cost", () => {
    expect(createItemSchema.safeParse({ ...item, unit: "bags" }).success).toBe(false);
    expect(createItemSchema.safeParse({ ...item, unitCostNpr: "12.5" }).success).toBe(false);
    expect(createItemSchema.parse({ ...item, unitCostNpr: "1,200" }).unitCostNpr).toBe(1200);
  });

  it("tidies the category's whitespace", () => {
    expect(createItemSchema.parse({ ...item, category: "  Bar   supplies " }).category).toBe("Bar supplies");
  });
});

describe("updateItemSchema", () => {
  it("has no quantity field to change", () => {
    const r = updateItemSchema.parse({ ...item, itemId: "abc", quantity: "999" });
    expect("quantity" in r).toBe(false);
  });
});

describe("recordMovementSchema", () => {
  const base = { itemId: "abc", quantity: "2", submissionId: "3f1c2d4e-9a7b-4c1d-8e2f-0a1b2c3d4e5f" };
  it("makes the note optional for USED and RECEIVED", () => {
    expect(recordMovementSchema.parse({ ...base, type: "USED" }).note).toBeNull();
    expect(recordMovementSchema.parse({ ...base, type: "RECEIVED", note: "Delivery" }).note).toBe("Delivery");
  });
  it("requires a note for ADJUSTED", () => {
    expect(recordMovementSchema.safeParse({ ...base, type: "ADJUSTED" }).success).toBe(false);
    expect(recordMovementSchema.safeParse({ ...base, type: "ADJUSTED", note: "   " }).success).toBe(false);
    expect(recordMovementSchema.safeParse({ ...base, type: "ADJUSTED", note: "Broken jars" }).success).toBe(true);
  });
  it("requires a well-formed submission token", () => {
    expect(recordMovementSchema.safeParse({ itemId: "abc", quantity: "2", type: "USED" }).success).toBe(false);
    expect(recordMovementSchema.safeParse({ ...base, type: "USED", submissionId: "short" }).success).toBe(false);
    expect(recordMovementSchema.safeParse({ ...base, type: "USED", submissionId: "x".repeat(65) }).success).toBe(false);
    expect(recordMovementSchema.safeParse({ ...base, type: "USED", submissionId: "has spaces in it, not ok!" }).success).toBe(false);
  });
  it("rejects unknown types and bad amounts", () => {
    expect(recordMovementSchema.safeParse({ ...base, type: "STOLEN" }).success).toBe(false);
    expect(recordMovementSchema.safeParse({ ...base, type: "USED", quantity: "" }).success).toBe(false);
    expect(recordMovementSchema.safeParse({ ...base, type: "USED", quantity: "-1" }).success).toBe(false);
  });
});

describe("item usage flags", () => {
  it("reads ticked checkboxes as true and missing ones as false", () => {
    expect(createItemSchema.parse({ ...item }).isConsumable).toBe(false);
    expect(createItemSchema.parse({ ...item, isConsumable: "on", isFixedInRoom: "on" })).toMatchObject({
      isConsumable: true,
      isFixedInRoom: true,
    });
  });
});

const token = "0123456789abcdef-token";

describe("transferStockSchema", () => {
  const base = { itemId: "i1", submissionId: token, fromLocationId: "a", toLocationId: "b", quantity: "2" };

  it("accepts a move and defaults a blank note to null", () => {
    expect(transferStockSchema.parse({ ...base, note: "" })).toMatchObject({ quantity: "2", note: null });
  });

  it("needs both places and a sensible amount", () => {
    expect(transferStockSchema.safeParse({ ...base, toLocationId: "" }).success).toBe(false);
    expect(transferStockSchema.safeParse({ ...base, fromLocationId: "" }).success).toBe(false);
    expect(transferStockSchema.safeParse({ ...base, quantity: "-1" }).success).toBe(false);
    expect(transferStockSchema.safeParse({ ...base, quantity: "1.234" }).success).toBe(false);
    expect(transferStockSchema.safeParse({ ...base, submissionId: "x" }).success).toBe(false);
  });
});

describe("writeOffStockSchema", () => {
  const base = { itemId: "i1", submissionId: token, kind: "LOST", fromLocationId: "a", quantity: "1", note: "Guest took it" };

  it("accepts lost or damaged with a note", () => {
    expect(writeOffStockSchema.parse(base).kind).toBe("LOST");
    expect(writeOffStockSchema.parse({ ...base, kind: "DAMAGED" }).kind).toBe("DAMAGED");
  });

  it("requires a note and a valid kind", () => {
    expect(writeOffStockSchema.safeParse({ ...base, note: "" }).success).toBe(false);
    expect(writeOffStockSchema.safeParse({ ...base, note: "   " }).success).toBe(false);
    expect(writeOffStockSchema.safeParse({ ...base, kind: "STOLEN" }).success).toBe(false);
  });
});
