import { describe, expect, it } from "vitest";
import { invoiceDisplayLines, invoiceDisplayTotalsRows } from "./lines";

describe("invoice table and totals compatibility", () => {
  it("uses distinct quantity labels for rooms and charges without folding quantity into descriptions", () => {
    const lines = invoiceDisplayLines({
      invoiceLines: [
        { id: "r", type: "ROOM", description: "Cottage · 1", ratePerNightNpr: 2500, standardRateNpr: 3000, nights: 2, amountNpr: 5000 },
        { id: "c", type: "CHARGE", description: "Laundry", calculation: "QUANTITY", quantity: 3, unitLabel: "pcs", unitAmountNpr: 100, amountNpr: 300 },
      ], roomLines: [], extraLines: [],
    });
    expect(lines[0]).toMatchObject({ description: "Cottage · 1", rateNpr: 2500, quantity: 2, quantityLabel: "nights" });
    expect(lines[1]).toMatchObject({ description: "Laundry", rateNpr: 100, quantity: 3, quantityLabel: "pcs" });
    expect(lines[1].description).not.toContain("3 pcs ×");
  });

  it("renders legacy invoice taxes stored inside invoiceLines without treating them as item lines", () => {
    const invoice = {
      invoiceLines: [
        { id: "r", type: "ROOM", description: "Room A", ratePerNightNpr: 1250, standardRateNpr: 1500, nights: 2, amountNpr: 2500 },
        { id: "old-tax", type: "TAX", description: "VAT", calculation: "PERCENT", percentage: 13, amountNpr: 390 },
      ], taxLines: [], roomLines: [], extraLines: [], subtotalNpr: 0, taxTotalNpr: 0, discountTotalNpr: 500, grandTotalNpr: 2890,
    };
    expect(invoiceDisplayLines(invoice)).toHaveLength(1);
    expect(invoiceDisplayTotalsRows(invoice)).toMatchObject([
      { kind: "subtotal", amountNpr: 3000 },
      { kind: "discount", amountNpr: -500 },
      { kind: "net", amountNpr: 2500 },
      { kind: "tax", label: "VAT 13% on NPR 3,000 —", amountNpr: 390 },
      { kind: "amountDue", amountNpr: 2890 },
    ]);
  });
});
