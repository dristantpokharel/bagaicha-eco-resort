import { describe, expect, it } from "vitest";
import { calculateInvoiceTotals, invoiceNumber, invoiceTotalsRows } from "./pricing";

const room = { id: "b1", roomTypeName: "Cottage", roomName: "1", standardRateNpr: 4000, childRateNpr: 500, children: 1, discountedRateNpr: 3500 };

describe("invoice calculations", () => {
  it("calculates tax on the subtotal after discounts and supports multiple tax rows", () => {
    const totals = calculateInvoiceTotals([room], [
      { id: "charge", type: "CHARGE", description: "Laundry", reference: null, quantity: 2, unitAmountNpr: 100 },
      { id: "discount", type: "DISCOUNT", description: "Special discount", reference: null, quantity: 1, unitAmountNpr: 200 },
    ], 2, { taxRows: [
      { id: "vat", label: "VAT", mode: "PERCENT", percentage: 13 },
      { id: "service", label: "Service charge", mode: "FIXED", amountNpr: 100 },
    ] });
    expect(totals.subtotalNpr).toBe(8200);
    expect(totals.discountTotalNpr).toBe(200);
    expect(totals.netNpr).toBe(8000);
    expect(totals.taxLines).toMatchObject([
      { label: "VAT", mode: "PERCENT", percentage: 13, baseNpr: 8000, amountNpr: 1040 },
      { label: "Service charge", mode: "FIXED", percentage: null, baseNpr: 8000, amountNpr: 100 },
    ]);
    expect(totals.taxTotalNpr).toBe(1140);
    expect(totals.grandTotalNpr).toBe(9140);
    expect(invoiceTotalsRows(totals).map((row) => row.kind)).toEqual(["subtotal", "discount", "net", "tax", "tax", "amountDue"]);
  });
  it("rounds each percentage tax to whole NPR and validates tax bounds and whole-NPR rates", () => {
    const half = calculateInvoiceTotals([{ ...room, standardRateNpr: 101, childRateNpr: 0, children: 0, discountedRateNpr: 101 }], [], 1, { taxRows: [{ id: "t", label: "VAT", mode: "PERCENT", percentage: 12.5 }] });
    expect(half.taxLines[0].amountNpr).toBe(13);
    expect(() => calculateInvoiceTotals([], [], 1, { taxRows: [{ id: "t", label: "VAT", mode: "PERCENT", percentage: 100.01 }] })).toThrow(/0 to 100/);
    expect(() => calculateInvoiceTotals([], [{ id: "c", type: "CHARGE", description: "Bad", reference: null, quantity: 1, unitAmountNpr: -1 }], 1)).toThrow(/whole/);
  });
  it("rejects discounts exceeding the subtotal and rates over standard unless allowed", () => {
    expect(() => calculateInvoiceTotals([room], [{ id: "d", type: "DISCOUNT", description: "Too much", reference: null, quantity: 1, unitAmountNpr: 9000 }], 2)).toThrow(/Discounts cannot exceed/);
    expect(() => calculateInvoiceTotals([{ ...room, discountedRateNpr: 4001 }], [], 1)).toThrow(/exceed/);
    expect(calculateInvoiceTotals([{ ...room, discountedRateNpr: 4001 }], [], 1, { allowAboveStandard: true }).grandTotalNpr).toBe(4501);
  });
  it("formats sequential invoice numbers", () => {
    expect(invoiceNumber(2026, 1)).toBe("INV-2026-000001");
    expect(invoiceNumber(2027, 123456)).toBe("INV-2027-123456");
  });
});
