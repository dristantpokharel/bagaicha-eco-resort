import { describe, expect, it } from "vitest";
import { issueInvoiceSchema, markInvoicePaidSchema, voidInvoiceSchema } from "./schemas";

describe("invoice validation", () => {
  it("validates whole-NPR room rates and all adjustment line types", () => {
    const parse = (rate: unknown) => issueInvoiceSchema.safeParse({ reservationId: "r1", roomLines: [{ bookingId: "b1", discountedRateNpr: rate }], adjustmentLines: JSON.stringify([
      { id: "c", type: "CHARGE", description: "Laundry", quantity: 2, unitAmountNpr: 100 },
      { id: "t", type: "TAX", description: "VAT", calculation: "PERCENT", percentage: 13 },
      { id: "d", type: "DISCOUNT", description: "Special discount", quantity: 1, unitAmountNpr: 50 },
    ]), allowAboveStandard: false });
    expect(parse("0").success).toBe(true);
    expect(parse("1234").success).toBe(true);
    expect(parse("1.5").success).toBe(false);
    expect(parse("-1").success).toBe(false);
  });
  it("requires payment details and a void reason", () => {
    expect(markInvoicePaidSchema.safeParse({ invoiceId: "i", paymentMethod: "CASH", paidDate: "2026-11-17", paymentNote: "" }).success).toBe(true);
    expect(markInvoicePaidSchema.safeParse({ invoiceId: "i", paymentMethod: "CARD", paidDate: "2026-11-17" }).success).toBe(false);
    expect(voidInvoiceSchema.safeParse({ invoiceId: "i", reason: "Correction" }).success).toBe(true);
    expect(voidInvoiceSchema.safeParse({ invoiceId: "i", reason: "  " }).success).toBe(false);
  });
});
