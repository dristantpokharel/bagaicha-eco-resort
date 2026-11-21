import { z } from "zod";

const wholeNpr = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? Number.NaN : value,
  z.coerce.number().int("Enter a whole NPR amount.").min(0, "Amount cannot be negative.").max(2_147_483_647).safe(),
);
const jsonArray = <T extends z.ZodType>(schema: T) => z.preprocess((value) => {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}, schema);

const adjustmentLines = z.array(z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1), type: z.literal("CHARGE"), description: z.string().trim().min(1).max(240), reference: z.string().trim().max(120).optional().default(""),
    quantity: z.number().finite().positive(), unitAmountNpr: wholeNpr, unitLabel: z.string().trim().max(40).optional().default(""), sourceExtraId: z.string().min(1).optional(),
  }),
  z.object({
    id: z.string().min(1), type: z.literal("DISCOUNT"), description: z.string().trim().min(1).max(240), reference: z.string().trim().max(120).optional().default(""),
    quantity: z.number().finite().positive(), unitAmountNpr: wholeNpr,
  }),
]));

const taxRows = z.array(z.discriminatedUnion("mode", [
  z.object({ id: z.string().min(1), label: z.string().trim().min(1).max(80), mode: z.literal("PERCENT"), percentage: z.number().finite().min(0).max(100).refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, "Use up to 2 decimal places.") }),
  z.object({ id: z.string().min(1), label: z.string().trim().min(1).max(80), mode: z.literal("FIXED"), amountNpr: wholeNpr }),
]));

export const issueInvoiceSchema = z.object({
  reservationId: z.string().min(1),
  submissionId: z.uuid(),
  roomLines: z.array(z.object({ bookingId: z.string().min(1), discountedRateNpr: wholeNpr })).min(1),
  adjustmentLines: jsonArray(adjustmentLines),
  taxRows: jsonArray(taxRows),
  allowAboveStandard: z.boolean().default(false),
}).superRefine((value, ctx) => {
  const roomIds = value.roomLines.map((line) => line.bookingId);
  const lineIds = value.adjustmentLines.map((line) => line.id);
  const sourceExtraIds = value.adjustmentLines.flatMap((line) => line.type === "CHARGE" && line.sourceExtraId ? [line.sourceExtraId] : []);
  if (new Set(roomIds).size !== roomIds.length) ctx.addIssue({ code: "custom", path: ["roomLines"], message: "Duplicate invoice room line." });
  if (new Set(lineIds).size !== lineIds.length) ctx.addIssue({ code: "custom", path: ["adjustmentLines"], message: "Duplicate invoice line." });
  if (new Set(sourceExtraIds).size !== sourceExtraIds.length) ctx.addIssue({ code: "custom", path: ["adjustmentLines"], message: "A booking extra can only be added once." });
  const taxIds = value.taxRows.map((line) => line.id);
  if (new Set(taxIds).size !== taxIds.length) ctx.addIssue({ code: "custom", path: ["taxRows"], message: "Duplicate tax row." });
});

const standaloneLines = jsonArray(z.array(z.discriminatedUnion("type", [
  z.object({ id: z.string().min(1), type: z.literal("CHARGE"), description: z.string().trim().min(1).max(240), reference: z.string().trim().max(120).optional().default(""), quantity: z.number().finite().positive(), unitAmountNpr: wholeNpr }),
  z.object({ id: z.string().min(1), type: z.literal("DISCOUNT"), description: z.string().trim().min(1).max(240), reference: z.string().trim().max(120).optional().default(""), quantity: z.number().finite().positive(), unitAmountNpr: wholeNpr }),
])).min(1));

export const standaloneInvoiceSchema = z.object({
  submissionId: z.uuid(),
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().min(1).max(40),
  email: z.email().or(z.literal("")).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
  invoiceDate: z.iso.date(),
  checkIn: z.union([z.iso.date(), z.literal("")]).optional().default(""),
  checkOut: z.union([z.iso.date(), z.literal("")]).optional().default(""),
  referenceNote: z.string().trim().max(500).optional().default(""),
  saveAsGuest: z.boolean().default(false),
  lines: standaloneLines,
  taxRows: jsonArray(taxRows),
}).superRefine((value, ctx) => {
  const ids = value.lines.map((line) => line.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["lines"], message: "Duplicate invoice line." });
  if (Boolean(value.checkIn) !== Boolean(value.checkOut)) ctx.addIssue({ code: "custom", path: ["checkIn"], message: "Enter both stay dates or leave both blank." });
  if (value.checkIn && value.checkOut && value.checkOut <= value.checkIn) ctx.addIssue({ code: "custom", path: ["checkOut"], message: "Check-out must be after check-in." });
  const taxIds = value.taxRows.map((line) => line.id);
  if (new Set(taxIds).size !== taxIds.length) ctx.addIssue({ code: "custom", path: ["taxRows"], message: "Duplicate tax row." });
});

export const linkInvoiceReservationSchema = z.object({ invoiceId: z.string().min(1), reservationId: z.string().min(1) });
export const markInvoicePaidSchema = z.object({
  invoiceId: z.string().min(1),
  paymentMethod: z.enum(["CASH", "CHEQUE", "FONEPAY", "ESEWA", "BANK_TRANSFER"]),
  paidDate: z.iso.date(),
  paymentNote: z.string().trim().max(500).optional().default(""),
});
export const voidInvoiceSchema = z.object({ invoiceId: z.string().min(1), reason: z.string().trim().min(1, "Enter a reason for voiding the invoice.").max(1000) });
export const emailInvoiceSchema = z.object({ invoiceId: z.string().min(1) });
export const invoiceFilterSchema = z.object({
  source: z.enum(["RESERVATION", "STANDALONE"]).optional(),
  status: z.enum(["ISSUED", "PAID", "VOID"]).optional(),
  paymentMethod: z.enum(["CASH", "CHEQUE", "FONEPAY", "ESEWA", "BANK_TRANSFER"]).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  q: z.string().trim().max(100).optional(),
});
