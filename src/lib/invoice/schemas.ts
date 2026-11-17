import { z } from "zod";

const wholeNpr = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? Number.NaN : value,
  z.coerce.number().int("Enter a whole NPR amount.").min(0, "Amount cannot be negative.").max(2_147_483_647).safe(),
);

export const issueInvoiceSchema = z.object({
  reservationId: z.string().min(1),
  roomLines: z.array(z.object({ bookingId: z.string().min(1), discountedRateNpr: wholeNpr })).min(1),
  extras: z.array(z.object({ extraId: z.string().min(1), priceNpr: wholeNpr })),
  allowAboveStandard: z.boolean().default(false),
}).superRefine((value, ctx) => {
  for (const [key, rows] of [["roomLines", value.roomLines], ["extras", value.extras]] as const) {
    const ids = rows.map((row) => key === "roomLines" ? (row as { bookingId: string }).bookingId : (row as { extraId: string }).extraId);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: [key], message: "Duplicate invoice line." });
  }
});

export const markInvoicePaidSchema = z.object({
  invoiceId: z.string().min(1),
  paymentMethod: z.enum(["CASH", "CHEQUE", "FONEPAY", "ESEWA", "BANK_TRANSFER"]),
  paidDate: z.iso.date(),
  paymentNote: z.string().trim().max(500).optional().default(""),
});

export const voidInvoiceSchema = z.object({
  invoiceId: z.string().min(1),
  reason: z.string().trim().min(1, "Enter a reason for voiding the invoice.").max(1000),
});

export const emailInvoiceSchema = z.object({ invoiceId: z.string().min(1) });

export const invoiceFilterSchema = z.object({
  status: z.enum(["ISSUED", "PAID", "VOID"]).optional(),
  paymentMethod: z.enum(["CASH", "CHEQUE", "FONEPAY", "ESEWA", "BANK_TRANSFER"]).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  q: z.string().trim().max(100).optional(),
});
