"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/auth";
import { ActionError, runAction, type ActionResult } from "@/lib/actions";
import { db } from "@/lib/db";
import { parseDateOnly } from "@/lib/booking/dates";
import { issueInvoiceSchema, markInvoicePaidSchema, voidInvoiceSchema, emailInvoiceSchema } from "@/lib/invoice/schemas";
import { InvoiceRuleError, issueInvoice, markInvoicePaid, voidInvoice } from "@/lib/invoice/service";
import { sendEmail } from "@/lib/email/send";
import { escapeHtml } from "@/lib/email/escape";
import { emailLogoUrl, EMAIL_LOGO_WIDTH } from "@/lib/email/logo";
import { formatNpr } from "@/lib/money";
import { formatStayDate } from "@/lib/booking/dates";
import { formatDateTime } from "@/lib/dates";

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
    const extras: { extraId: string; priceNpr: unknown }[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("roomRate:")) roomLines.push({ bookingId: key.slice(9), discountedRateNpr: value });
      if (key.startsWith("extraPrice:")) extras.push({ extraId: key.slice(11), priceNpr: value });
    }
    const parsed = issueInvoiceSchema.safeParse({
      reservationId,
      roomLines,
      extras,
      allowAboveStandard: formData.get("allowAboveStandard") === "on",
    });
    if (!parsed.success) throw new ActionError(parsed.error.issues[0]?.message ?? "Check the invoice amounts.");
    try {
      await db.$transaction((tx) =>
        issueInvoice(tx, {
          reservationId,
          userId: actor.id,
          roomRates: Object.fromEntries(parsed.data.roomLines.map((line) => [line.bookingId, line.discountedRateNpr])),
          extraPrices: Object.fromEntries(parsed.data.extras.map((line) => [line.extraId, line.priceNpr])),
          allowAboveStandard: parsed.data.allowAboveStandard,
        }),
      );
    } catch (error) {
      if (error instanceof InvoiceRuleError) throw new ActionError(error.message);
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ActionError("This reservation already has an active invoice. Void it before issuing another.");
      throw error;
    }
    revalidateInvoices(reservationId);
    return { ok: true, message: "Invoice issued from the current reservation snapshot." };
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
    const business = await db.businessInfo.findUnique({ where: { id: 1 } });
    const roomLines = invoice.roomLines as Array<{ roomTypeName: string; roomName: string | null; standardRateNpr: number; discountedRateNpr: number; children: number; nights: number; childChargeNpr: number; discountNpr: number; discountedTotalNpr: number }>;
    const extraLines = invoice.extraLines as Array<{ name: string; quantity: number; unit: string; totalNpr: number }>;
    const logo = emailLogoUrl();
    const esc = escapeHtml;
    const statusLine = invoice.status === "PAID"
      ? `Paid${invoice.paymentMethod ? ` · ${invoice.paymentMethod.replaceAll("_", " ")}` : ""}${invoice.paidAt ? ` · ${formatStayDate(invoice.paidAt)}` : ""}`
      : "Issued · Payment pending";
    const roomHtml = roomLines.map((line) => `<tr><td style="padding:8px;border-bottom:1px solid #ddd">${esc(line.roomTypeName)}${line.roomName ? ` · ${esc(line.roomName)}` : ""}<br><small>${line.nights} night${line.nights === 1 ? "" : "s"}${line.children ? ` · ${line.children} child${line.children === 1 ? "" : "ren"} · Child charge ${formatNpr(line.childChargeNpr)}` : ""}</small></td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${formatNpr(line.standardRateNpr)}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${formatNpr(line.discountedRateNpr)}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${formatNpr(line.standardRateNpr - line.discountedRateNpr)}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${formatNpr(line.discountedTotalNpr)}</td></tr>`).join("");
    const extraHtml = extraLines.map((line) => `<tr><td style="padding:8px;border-bottom:1px solid #ddd">${esc(String(line.quantity))} ${esc(line.unit)} · ${esc(line.name)}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">—</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">—</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">—</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${line.totalNpr ? formatNpr(line.totalNpr) : "Included"}</td></tr>`).join("");
    const rows = `${roomHtml}${extraHtml}`;
    const businessName = business?.name || "Bagaicha Eco Resort";
    const details = [business?.address, business?.phones.join(" · "), business?.emails.join(" · "), business?.panVatNumber && !business.placeholderFields.includes("panVatNumber") ? `PAN / VAT: ${business.panVatNumber}` : null].filter(Boolean).map((line) => `<div>${esc(line!)}</div>`).join("");
    const footer = business?.invoiceFooterNote && !business.placeholderFields.includes("invoiceFooterNote") ? `<p>${esc(business.invoiceFooterNote)}</p>` : "";
    const logoHtml = logo ? `<img src="${esc(logo)}" width="${EMAIL_LOGO_WIDTH}" alt="${esc(businessName)}" style="display:block;margin-bottom:12px">` : `<strong>${esc(businessName)}</strong>`;
    const html = `<main style="max-width:820px;margin:auto;font:15px Arial,sans-serif;color:#283327"><header>${logoHtml}${details}</header><hr style="border:0;border-top:1px solid #d9d4bf;margin:20px 0"><h1 style="font-size:24px">Invoice ${esc(invoice.number)}</h1><p>Issued: ${esc(formatDateTime(invoice.issuedAt))}</p><p>${esc(guest.name)}${guest.email ? ` · ${esc(guest.email)}` : ""}${guest.phone ? ` · ${esc(guest.phone)}` : ""}${guest.country ? ` · ${esc(guest.country)}` : ""}</p><p>Booking ${esc(invoice.reservationRef)} · ${esc(formatStayDate(invoice.checkIn))} – ${esc(formatStayDate(invoice.checkOut))} · ${invoice.nights} nights</p><table style="border-collapse:collapse;width:100%"><thead><tr><th style="text-align:left;padding:8px">Description</th><th style="text-align:right;padding:8px">Standard / night</th><th style="text-align:right;padding:8px">Discounted / night</th><th style="text-align:right;padding:8px">Discount / night</th><th style="text-align:right;padding:8px">Line total</th></tr></thead><tbody>${rows}</tbody></table><p>Subtotal at standard rates: ${formatNpr(invoice.standardSubtotalNpr)}<br>Total discount: ${formatNpr(invoice.discountTotalNpr)}<br><strong>Amount sent: ${formatNpr(invoice.grandTotalNpr)}</strong></p><p>Payment status: ${esc(statusLine)}</p>${invoice.paymentNote ? `<p>Payment note: ${esc(invoice.paymentNote)}</p>` : ""}${footer}</main>`;
    const text = `${businessName}\n${business?.address ?? ""}\n${business?.phones.join(" · ") ?? ""}\n${business?.emails.join(" · ") ?? ""}${business?.panVatNumber && !business.placeholderFields.includes("panVatNumber") ? `\nPAN / VAT: ${business.panVatNumber}` : ""}\nInvoice ${invoice.number}\nIssued: ${formatDateTime(invoice.issuedAt)}\nGuest: ${guest.name}${guest.email ? ` · ${guest.email}` : ""}${guest.phone ? ` · ${guest.phone}` : ""}${guest.country ? ` · ${guest.country}` : ""}\nBooking: ${invoice.reservationRef}\nStay: ${formatStayDate(invoice.checkIn)} – ${formatStayDate(invoice.checkOut)} (${invoice.nights} nights)\n${roomLines.map((line) => `${line.roomTypeName}${line.roomName ? ` · ${line.roomName}` : ""}: standard ${formatNpr(line.standardRateNpr)}/night, discounted ${formatNpr(line.discountedRateNpr)}/night, discount ${formatNpr(line.standardRateNpr - line.discountedRateNpr)}/night${line.children ? `, ${line.children} child${line.children === 1 ? "" : "ren"}, child charge ${formatNpr(line.childChargeNpr)}` : ""}, line total ${formatNpr(line.discountedTotalNpr)}`).join("\n")}\n${extraLines.map((line) => `${line.quantity} ${line.unit} · ${line.name}: ${line.totalNpr ? formatNpr(line.totalNpr) : "Included"}`).join("\n")}\nSubtotal at standard rates: ${formatNpr(invoice.standardSubtotalNpr)}\nTotal discount: ${formatNpr(invoice.discountTotalNpr)}\nAmount sent: ${formatNpr(invoice.grandTotalNpr)}\nPayment status: ${statusLine}${invoice.paymentNote ? `\nPayment note: ${invoice.paymentNote}` : ""}${business?.invoiceFooterNote && !business.placeholderFields.includes("invoiceFooterNote") ? `\n${business.invoiceFooterNote}` : ""}`;
    const result = await sendEmail({ to: guest.email, subject: `Invoice ${invoice.number} · ${businessName}`, html, text });
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
    const values = Object.fromEntries(formData.entries());
    const parsed = markInvoicePaidSchema.safeParse(values);
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
