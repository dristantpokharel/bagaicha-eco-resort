import { describe, expect, it } from "vitest";
import { calculateInvoiceTotals, invoiceNumber } from "./pricing";

describe("invoice calculations", () => {
  it("calculates room discount, unchanged child charges, extras, and summary amounts", () => {
    const totals = calculateInvoiceTotals([
      { id: "b1", roomTypeName: "Cottage", roomName: "1", standardRateNpr: 4000, childRateNpr: 500, children: 1, discountedRateNpr: 3500 },
      { id: "b2", roomTypeName: "Garden Room", roomName: null, standardRateNpr: 2500, childRateNpr: 0, children: 0, discountedRateNpr: 2500 },
    ], [{ id: "e1", name: "Extra blanket", unit: "pcs", quantity: 1, priceNpr: 300 }], 2);

    expect(totals.roomLines[0]).toMatchObject({ childChargeNpr: 1000, standardTotalNpr: 9000, discountedTotalNpr: 8000, discountNpr: 1000 });
    expect(totals.standardSubtotalNpr).toBe(14000);
    expect(totals.discountTotalNpr).toBe(1000);
    expect(totals.grandTotalNpr).toBe(13300);
  });

  it("rejects rates above standard and invalid whole-NPR amounts", () => {
    expect(() => calculateInvoiceTotals([{ id: "b", roomTypeName: "Room", roomName: null, standardRateNpr: 1000, childRateNpr: 0, children: 0, discountedRateNpr: 1001 }], [], 1)).toThrow(/exceed/);
    expect(() => calculateInvoiceTotals([{ id: "b", roomTypeName: "Room", roomName: null, standardRateNpr: 1000.5, childRateNpr: 0, children: 0, discountedRateNpr: 500 }], [], 1)).toThrow(/whole/);
    expect(() => calculateInvoiceTotals([], [{ id: "e", name: "x", unit: "pcs", quantity: 1, priceNpr: -1 }], 1)).toThrow(/valid/);
  });

  it("accepts an above-standard rate only when explicitly allowed and records a negative discount", () => {
    const totals = calculateInvoiceTotals([{ id: "b", roomTypeName: "Room", roomName: null, standardRateNpr: 1000, childRateNpr: 0, children: 0, discountedRateNpr: 1200 }], [], 2, { allowAboveStandard: true });
    expect(totals.discountTotalNpr).toBe(-400);
    expect(totals.grandTotalNpr).toBe(2400);
  });

  it("formats sequential invoice numbers", () => {
    expect(invoiceNumber(2026, BigInt(1))).toBe("INV-2026-000001");
    expect(invoiceNumber(2026, 123456)).toBe("INV-2026-123456");
    expect(invoiceNumber(2027, 1)).toBe("INV-2027-000001");
  });
});
