import { describe, expect, it, vi } from "vitest";
// lib/actions pulls in Auth.js through the session module; the rules under test never use it.
vi.mock("@/lib/auth/session", () => ({ AuthorizationError: class extends Error {} }));

import { ActionError } from "@/lib/actions";
import { applyMovement, canonicalCategory, formatQuantity, isLowStock, isOutOfStock } from "./stock";

const run = (type: "RECEIVED" | "USED" | "ADJUSTED", current: string, amount: string, unit = "kg") =>
  applyMovement({ type, current, amount, unit });

describe("applyMovement", () => {
  it("adds received stock", () => {
    const r = run("RECEIVED", "2.5", "1.25");
    expect(r.delta.toString()).toBe("1.25");
    expect(r.balanceAfter.toString()).toBe("3.75");
  });

  it("removes used stock with a negative delta", () => {
    const r = run("USED", "10", "2.5");
    expect(r.delta.toString()).toBe("-2.5");
    expect(r.balanceAfter.toString()).toBe("7.5");
  });

  it("allows using exactly all the stock", () => {
    expect(run("USED", "3", "3").balanceAfter.toString()).toBe("0");
  });

  it("rejects using more than is in stock and says how much there is", () => {
    expect(() => run("USED", "3", "3.01")).toThrow(/Only 3 kg in stock/);
    expect(() => run("USED", "0", "1")).toThrow(ActionError);
  });

  it("rejects zero and negative amounts for received/used", () => {
    expect(() => run("RECEIVED", "1", "0")).toThrow(ActionError);
    expect(() => run("USED", "1", "0")).toThrow(ActionError);
    expect(() => run("USED", "1", "-1")).toThrow(ActionError);
  });

  it("adjusts to the counted amount, up or down", () => {
    const down = run("ADJUSTED", "10", "7.5");
    expect(down.delta.toString()).toBe("-2.5");
    expect(down.balanceAfter.toString()).toBe("7.5");
    const up = run("ADJUSTED", "1", "4");
    expect(up.delta.toString()).toBe("3");
    expect(run("ADJUSTED", "5", "0").balanceAfter.toString()).toBe("0");
  });

  it("rejects an adjustment that changes nothing", () => {
    expect(() => run("ADJUSTED", "5", "5")).toThrow(/matches the current stock/);
  });

  it("keeps decimal arithmetic exact", () => {
    expect(run("RECEIVED", "0.1", "0.2").balanceAfter.toString()).toBe("0.3");
  });

  it("requires whole numbers for pcs, box and pack but not kg or L", () => {
    try {
      run("RECEIVED", "1", "1.5", "pcs");
      expect.unreachable();
    } catch (error) {
      expect((error as ActionError).fieldErrors?.quantity).toMatch(/can't be split/);
    }
    expect(() => run("USED", "5", "0.5", "box")).toThrow(ActionError);
    expect(() => run("ADJUSTED", "5", "2.5", "pack")).toThrow(ActionError);
    expect(run("USED", "5", "0.5", "L").balanceAfter.toString()).toBe("4.5");
    expect(run("RECEIVED", "1", "3", "pcs").balanceAfter.toString()).toBe("4");
  });
});

describe("isLowStock", () => {
  const item = (quantity: string, lowStockThreshold: string, isActive = true) => ({ isActive, quantity, lowStockThreshold });
  it("is low at or below the threshold", () => {
    expect(isLowStock(item("5", "5"))).toBe(true);
    expect(isLowStock(item("4.99", "5"))).toBe(true);
    expect(isLowStock(item("5.01", "5"))).toBe(false);
  });
  it("never alerts with a threshold of 0, even at zero stock", () => {
    expect(isLowStock(item("0", "0"))).toBe(false);
  });
  it("ignores archived items", () => {
    expect(isLowStock(item("0", "5", false))).toBe(false);
  });
  it("flags out of stock only when it would alert", () => {
    expect(isOutOfStock(item("0", "5"))).toBe(true);
    expect(isOutOfStock(item("1", "5"))).toBe(false);
    expect(isOutOfStock(item("0", "0"))).toBe(false);
  });
});

describe("formatQuantity", () => {
  it("drops trailing zeros and groups thousands", () => {
    expect(formatQuantity("12.00")).toBe("12");
    expect(formatQuantity("8.50")).toBe("8.5");
    expect(formatQuantity("0")).toBe("0");
    expect(formatQuantity("1250.25")).toBe("1,250.25");
    expect(formatQuantity("100")).toBe("100");
  });
});

describe("canonicalCategory", () => {
  it("reuses the existing spelling", () => {
    expect(canonicalCategory("kitchen", ["Kitchen", "Linen"])).toBe("Kitchen");
    expect(canonicalCategory("Garden", ["Kitchen"])).toBe("Garden");
  });
});
