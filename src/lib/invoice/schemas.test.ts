import { describe, expect, it } from "vitest";
import { issueInvoiceSchema, markInvoicePaidSchema, voidInvoiceSchema } from "./schemas";

describe("invoice validation", () => {
  it("accepts nonnegative integer NPR and rejects decimals or negatives", () => {
    const parse = (discountedRateNpr: unknown) => issueInvoiceSchema.safeParse({ reservationId: "r1", roomLines: [{ bookingId: "b1", discountedRateNpr }], extras: [], allowAboveStandard: false });
    expect(parse("0").success).toBe(true);
    expect(parse("1234").success).toBe(true);
    expect(parse("1.5").success).toBe(false);
    expect(parse("-1").success).toBe(false);
  });

  it("requires a payment method and valid date to mark paid", () => {
    expect(markInvoicePaidSchema.safeParse({ invoiceId: "i", paymentMethod: "CASH", paidDate: "2026-11-17", paymentNote: "" }).success).toBe(true);
    expect(markInvoicePaidSchema.safeParse({ invoiceId: "i", paymentMethod: "CARD", paidDate: "2026-11-17" }).success).toBe(false);
    expect(markInvoicePaidSchema.safeParse({ invoiceId: "i", paymentMethod: "CASH", paidDate: "17-11-2026" }).success).toBe(false);
  });

  it("requires a reason to void", () => {
    expect(voidInvoiceSchema.safeParse({ invoiceId: "i", reason: "Correction" }).success).toBe(true);
    expect(voidInvoiceSchema.safeParse({ invoiceId: "i", reason: "  " }).success).toBe(false);
  });
});
