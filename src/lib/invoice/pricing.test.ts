import { describe, expect, it } from "vitest";
import { calculateInvoiceTotals, invoiceNumber } from "./pricing";

describe("invoice calculations", () => {
  it("calculates room snapshots, charges, taxes, discounts, and totals", () => {
    const totals = calculateInvoiceTotals([
      { id: "b1", roomTypeName: "Cottage", roomName: "1", standardRateNpr: 4000, childRateNpr: 500, children: 1, discountedRateNpr: 3500 },
    ], [
      { id: "bill", type: "CHARGE", description: "Restaurant bill #124", reference: "124", quantity: 2, unitAmountNpr: 100 },
      { id: "tax", type: "TAX", description: "VAT 12.5%", reference: null, calculation: "PERCENT", percentage: 12.5 },
      { id: "discount", type: "DISCOUNT", description: "Special discount", reference: null, quantity: 1, unitAmountNpr: 50 },
    ], 2);
    expect(totals.invoiceLines[0]).toMatchObject({ type: "ROOM", standardRateNpr: 4000, ratePerNightNpr: 3500, amountNpr: 8000 });
    expect(totals.subtotalNpr).toBe(8200);
    expect(totals.invoiceLines[2]).toMatchObject({ type: "TAX", amountNpr: 1025 });
    expect(totals.taxTotalNpr).toBe(1025);
    expect(totals.discountTotalNpr).toBe(50);
    expect(totals.grandTotalNpr).toBe(9175);
  });
  it("rounds percentage tax to whole NPR and validates rates and amounts", () => {
    expect(calculateInvoiceTotals([{ id: "b", roomTypeName: "Room", roomName: null, standardRateNpr: 101, childRateNpr: 0, children: 0, discountedRateNpr: 101 }], [{ id: "t", type: "TAX", description: "VAT", reference: null, calculation: "PERCENT", percentage: 12.5 }], 1).taxTotalNpr).toBe(13);
    expect(() => calculateInvoiceTotals([{ id: "b", roomTypeName: "Room", roomName: null, standardRateNpr: 1000, childRateNpr: 0, children: 0, discountedRateNpr: 1001 }], [], 1)).toThrow(/exceed/);
    expect(() => calculateInvoiceTotals([], [{ id: "e", type: "CHARGE", description: "bad", reference: null, quantity: 1, unitAmountNpr: -1 }], 1)).toThrow(/whole/);
  });
  it("accepts above-standard room rates only when allowed", () => {
    expect(calculateInvoiceTotals([{ id: "b", roomTypeName: "Room", roomName: null, standardRateNpr: 1000, childRateNpr: 0, children: 0, discountedRateNpr: 1200 }], [], 2, { allowAboveStandard: true }).grandTotalNpr).toBe(2400);
  });
  it("formats sequential invoice numbers", () => {
    expect(invoiceNumber(2026, 1)).toBe("INV-2026-000001");
    expect(invoiceNumber(2027, 123456)).toBe("INV-2027-123456");
  });
});
