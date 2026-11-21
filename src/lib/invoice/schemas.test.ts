import { describe, expect, it } from "vitest";
import { invoiceFilterSchema, issueInvoiceSchema, markInvoicePaidSchema, standaloneInvoiceSchema, voidInvoiceSchema } from "./schemas";

const issue = (rate: unknown, adjustmentLines: unknown[] = [], taxRows: unknown[] = []) => issueInvoiceSchema.safeParse({
  reservationId: "r1", submissionId: "4c536ff0-1542-4a71-9c6c-5de7cba795dd", roomLines: [{ bookingId: "b1", discountedRateNpr: rate }],
  adjustmentLines: JSON.stringify(adjustmentLines), taxRows: JSON.stringify(taxRows), allowAboveStandard: false,
});

describe("invoice validation", () => {
  it("validates whole-NPR rates, Charge/Discount lines, and separate tax rows", () => {
    expect(issue("0", [{ id: "c", type: "CHARGE", description: "Laundry", quantity: 1, unitAmountNpr: 100 }, { id: "d", type: "DISCOUNT", description: "Discount", quantity: 1, unitAmountNpr: 5 }], [{ id: "t", label: "VAT", mode: "PERCENT", percentage: 13 }]).success).toBe(true);
    expect(issue("1.5").success).toBe(false);
    expect(issue("-1").success).toBe(false);
    expect(issue("1", [], [{ id: "t", label: "VAT", mode: "PERCENT", percentage: 100.01 }]).success).toBe(false);
    expect(issue("1", [], [{ id: "t", label: "VAT", mode: "PERCENT", percentage: 1.234 }]).success).toBe(false);
  });
  it("validates standalone lines and optional paired dates", () => {
    const base = { submissionId: "d907868c-7481-4c42-8f4c-aa6412e58f86", name: "Guest", phone: "9800000000", email: "", address: "", invoiceDate: "2026-11-20", checkIn: "", checkOut: "", referenceNote: "", saveAsGuest: false, lines: JSON.stringify([{ id: "1", type: "CHARGE", description: "Laundry", quantity: 2, unitAmountNpr: 100 }]), taxRows: JSON.stringify([{ id: "t", label: "VAT", mode: "PERCENT", percentage: 13 }]) };
    expect(standaloneInvoiceSchema.safeParse(base).success).toBe(true);
    expect(standaloneInvoiceSchema.safeParse({ ...base, checkIn: "2026-12-01" }).success).toBe(false);
    expect(standaloneInvoiceSchema.safeParse({ ...base, lines: JSON.stringify([{ id: "1", type: "TAX", description: "Not a line", quantity: 1, unitAmountNpr: 10 }]) }).success).toBe(false);
  });
  it("validates payment, void, and source filters", () => {
    expect(markInvoicePaidSchema.safeParse({ invoiceId: "i", paymentMethod: "CASH", paidDate: "2026-11-17", paymentNote: "" }).success).toBe(true);
    expect(markInvoicePaidSchema.safeParse({ invoiceId: "i", paymentMethod: "CARD", paidDate: "2026-11-17" }).success).toBe(false);
    expect(voidInvoiceSchema.safeParse({ invoiceId: "i", reason: "Correction" }).success).toBe(true);
    expect(voidInvoiceSchema.safeParse({ invoiceId: "i", reason: "  " }).success).toBe(false);
    expect(invoiceFilterSchema.safeParse({ source: "STANDALONE" }).success).toBe(true);
  });
});
