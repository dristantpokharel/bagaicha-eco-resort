"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/auth";
import { ActionError, runAction, type ActionResult } from "@/lib/actions";
import { db } from "@/lib/db";
import { parseDateOnly } from "@/lib/booking/dates";
import { issueInvoiceSchema, markInvoicePaidSchema, voidInvoiceSchema, emailInvoiceSchema, standaloneInvoiceSchema, linkInvoiceReservationSchema } from "@/lib/invoice/schemas";
import { InvoiceRuleError, issueInvoice, issueStandaloneInvoice, linkStandaloneInvoice, markInvoicePaid, voidInvoice } from "@/lib/invoice/service";
import { sendEmail } from "@/lib/email/send";
import { emailLogoUrl } from "@/lib/email/logo";
import { loadEmailContact } from "@/lib/email/contact";
import { renderInvoiceEmail } from "@/lib/invoice/email";

function revalidateInvoices(reservationId?: string) {
  revalidatePath("/admin/invoices");
  revalidatePath("/admin/invoices/[id]", "page");
  if (reservationId) revalidatePath(`/admin/bookings/${reservationId}`);
}

export async function issueInvoiceAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("invoices.issue");
    const reservationId = String(formData.get("reservationId") ?? "");
    const roomLines: { bookingId: string; discountedRateNpr: unknown }[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("roomRate:")) roomLines.push({ bookingId: key.slice(9), discountedRateNpr: value });
    }
    const parsed = issueInvoiceSchema.safeParse({
      reservationId,
      submissionId: formData.get("submissionId"),
      roomLines,
      adjustmentLines: formData.get("adjustmentLines"),
      taxRows: formData.get("taxRows"),
      allowAboveStandard: formData.get("allowAboveStandard") === "on",
    });
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Check the invoice lines.");
    let invoice;
    try {
      invoice = await db.$transaction((tx) => issueInvoice(tx, {
        reservationId,
        submissionId: parsed.data.submissionId,
        userId: actor.id,
        roomRates: Object.fromEntries(parsed.data.roomLines.map((line) => [line.bookingId, line.discountedRateNpr])),
        adjustmentLines: parsed.data.adjustmentLines,
        taxRows: parsed.data.taxRows,
        allowAboveStandard: parsed.data.allowAboveStandard,
      }));
    } catch (error) {
      if (error instanceof InvoiceRuleError) throw new ActionError(error.message);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        invoice = await db.invoice.findUnique({ where: { submissionId: parsed.data.submissionId } });
        if (!invoice) throw new ActionError("This reservation already has an active invoice. Void it before issuing another.");
      } else {
        throw error;
      }
    }
    revalidateInvoices(reservationId);
    return { ok: true, message: `Invoice ${invoice.number} issued.`, invoiceId: invoice.id };
  });
}

export async function issueStandaloneInvoiceAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("invoices.issue");
    const parsed = standaloneInvoiceSchema.safeParse({
      submissionId: formData.get("submissionId"),
      name: formData.get("name"), phone: formData.get("phone"), email: formData.get("email"), address: formData.get("address"),
      invoiceDate: formData.get("invoiceDate"), checkIn: formData.get("checkIn"), checkOut: formData.get("checkOut"),
      referenceNote: formData.get("referenceNote"), saveAsGuest: formData.get("saveAsGuest") === "on", lines: formData.get("lines"), taxRows: formData.get("taxRows"),
    });
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Check the standalone invoice details.");
    const invoiceDate = parseDateOnly(parsed.data.invoiceDate);
    const checkIn = parsed.data.checkIn ? parseDateOnly(parsed.data.checkIn) : null;
    const checkOut = parsed.data.checkOut ? parseDateOnly(parsed.data.checkOut) : null;
    if (!invoiceDate || (parsed.data.checkIn && !checkIn) || (parsed.data.checkOut && !checkOut)) throw new ActionError("Enter valid invoice and stay dates.");
    let invoice;
    try {
      invoice = await db.$transaction((tx) => issueStandaloneInvoice(tx, {
        submissionId: parsed.data.submissionId,
        userId: actor.id, name: parsed.data.name, phone: parsed.data.phone,
        email: parsed.data.email || null, address: parsed.data.address || null, invoiceDate,
        checkIn, checkOut, referenceNote: parsed.data.referenceNote || null, saveAsGuest: parsed.data.saveAsGuest,
        lines: parsed.data.lines, taxRows: parsed.data.taxRows,
      }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        invoice = await db.invoice.findUnique({ where: { submissionId: parsed.data.submissionId } });
        if (!invoice) throw error;
      } else {
        throw error;
      }
    }
    revalidateInvoices();
    return { ok: true, message: `Invoice ${invoice.number} issued.`, invoiceId: invoice.id };
  });
}

export async function linkStandaloneInvoiceAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("invoices.issue");
    const parsed = linkInvoiceReservationSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) throw new ActionError("Select a reservation to link.");
    try {
      await db.$transaction((tx) => linkStandaloneInvoice(tx, { ...parsed.data, userId: actor.id }));
    } catch (error) {
      if (error instanceof InvoiceRuleError) throw new ActionError(error.message);
      throw error;
    }
    revalidateInvoices();
    return { ok: true, message: "Reservation link recorded." };
  });
}

export async function emailInvoiceAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("invoices.issue");
    const parsed = emailInvoiceSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) throw new ActionError("Select a valid invoice.");
    const invoice = await db.invoice.findUnique({ where: { id: parsed.data.invoiceId } });
    if (!invoice) throw new ActionError("Invoice not found.");
    if (invoice.status === "VOID") throw new ActionError("Voided invoices cannot be emailed.");
    const guest = invoice.guestSnapshot as { name: string; email: string | null; phone: string | null; country: string | null };
    if (!guest.email) {
      await db.activityLog.create({ data: { userId: actor.id, action: "invoice.email_skipped", entityType: "Invoice", entityId: invoice.id, details: { number: invoice.number, result: "missing guest email" } } });
      throw new ActionError("This invoice has no guest email address.");
    }
    const row = await db.businessInfo.findUnique({ where: { id: 1 } });
    const business = {
      name: row?.name || "Bagaicha Eco Resort",
      address: row?.address ?? null,
      phones: row?.phones ?? [],
      emails: row?.emails ?? [],
      panVatNumber: row && !row.placeholderFields.includes("panVatNumber") ? row.panVatNumber : null,
      invoiceFooterNote: row && !row.placeholderFields.includes("invoiceFooterNote") ? row.invoiceFooterNote : null,
      contact: await loadEmailContact(),
    };
    const rendered = renderInvoiceEmail({ ...invoice, guestSnapshot: guest }, business, emailLogoUrl());
    const result = await sendEmail({ to: guest.email, ...rendered });
    await db.$transaction(async (tx) => {
      if (result.ok) await tx.invoice.update({ where: { id: invoice.id }, data: { emailedAt: new Date() } });
      await tx.activityLog.create({ data: {
        userId: actor.id,
        action: result.ok ? "invoice.emailed" : "invoice.email_failed",
        entityType: "Invoice",
        entityId: invoice.id,
        details: { number: invoice.number, result: result.ok ? "sent" : result.reason },
      } });
    });
    revalidateInvoices();
    if (!result.ok) throw new ActionError(result.reason === "not-configured" ? "Email is not configured for this environment." : "The email could not be sent. Please try again.");
    return { ok: true, message: result.redirectedTo ? "Invoice email sent to the configured development recipient." : "Invoice emailed to the guest." };
  });
}

export async function markInvoicePaidAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("invoices.issue");
    const parsed = markInvoicePaidSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Check the payment details.");
    const date = parseDateOnly(parsed.data.paidDate);
    if (!date) throw new ActionError("Enter a valid payment date.");
    try {
      await db.$transaction((tx) => markInvoicePaid(tx, {
        invoiceId: parsed.data.invoiceId,
        userId: actor.id,
        paymentMethod: parsed.data.paymentMethod,
        paidAt: date,
        note: parsed.data.paymentNote,
      }));
    } catch (error) {
      if (error instanceof InvoiceRuleError) throw new ActionError(error.message);
      throw error;
    }
    revalidateInvoices();
    return { ok: true, message: "Payment recorded." };
  });
}

export async function voidInvoiceAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("invoices.issue");
    const parsed = voidInvoiceSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Enter a void reason.");
    try {
      await db.$transaction((tx) => voidInvoice(tx, {
        invoiceId: parsed.data.invoiceId,
        userId: actor.id,
        reason: parsed.data.reason,
        allowPaid: actor.role === "ADMIN" || actor.role === "SUPERUSER",
      }));
    } catch (error) {
      if (error instanceof InvoiceRuleError) throw new ActionError(error.message);
      throw error;
    }
    revalidateInvoices();
    return { ok: true, message: "Invoice voided. You can now issue a replacement from the reservation." };
  });
}
