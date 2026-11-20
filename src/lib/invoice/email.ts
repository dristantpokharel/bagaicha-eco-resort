import { formatStayDate } from "@/lib/booking/dates";
import { formatNpr } from "@/lib/money";
import { escapeHtml } from "@/lib/email/escape";
import { invoiceDisplayLines, invoiceDisplayTotals } from "./lines";

export type InvoiceEmailInput = {
  number: string;
  reservationRef: string | null;
  guestSnapshot: { name: string; email: string | null; phone: string | null; country: string | null; address?: string | null; referenceNote?: string | null };
  invoiceDate: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  nights: number | null;
  issuedAt: Date;
  status: "ISSUED" | "PAID" | "VOID";
  paymentMethod: string | null;
  paidAt: Date | null;
  paymentNote: string | null;
  invoiceLines: unknown;
  roomLines: unknown;
  extraLines: unknown;
  subtotalNpr: number;
  taxTotalNpr: number;
  discountTotalNpr: number;
  grandTotalNpr: number;
};

export type InvoiceEmailBusiness = {
  name: string;
  address: string | null;
  phones: string[];
  emails: string[];
  panVatNumber: string | null;
  invoiceFooterNote: string | null;
};

function amountLabel(line: ReturnType<typeof invoiceDisplayLines>[number]) {
  if (line.included) return "Included";
  if (line.type === "DISCOUNT") return `−${formatNpr(line.amountNpr)}`;
  return formatNpr(line.amountNpr);
}

export function renderInvoiceEmail(invoice: InvoiceEmailInput, business: InvoiceEmailBusiness, logoUrl: string | null) {
  const guest = invoice.guestSnapshot;
  const lines = invoiceDisplayLines(invoice);
  const totals = invoiceDisplayTotals(invoice);
  const esc = escapeHtml;
  const paymentStatus = invoice.status === "PAID"
    ? `Paid${invoice.paymentMethod ? ` · ${invoice.paymentMethod.replaceAll("_", " ")}` : ""}${invoice.paidAt ? ` · ${formatStayDate(invoice.paidAt)}` : ""}`
    : invoice.status === "VOID" ? "VOID" : "Issued · Payment pending";
  const details = [
    business.address,
    business.phones.join(" · "),
    business.emails.join(" · "),
    business.panVatNumber ? `PAN / VAT: ${business.panVatNumber}` : null,
  ].filter(Boolean).map((value) => `<div>${esc(value!)}</div>`).join("");
  const logo = logoUrl
    ? `<img src="${esc(logoUrl)}" width="140" alt="${esc(business.name)}" style="display:block;margin-bottom:12px">`
    : `<strong>${esc(business.name)}</strong>`;
  const htmlRows = lines.map((line) => `<tr><td style="padding:8px;border-bottom:1px solid #ddd">${esc(line.description)}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${line.ratePerNightNpr === null ? "—" : formatNpr(line.ratePerNightNpr)}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${line.nights === null ? "—" : line.nights}</td><td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${amountLabel(line)}</td></tr>`).join("");
  const summary = `Subtotal: ${formatNpr(totals.subtotalNpr)}<br>Tax: ${formatNpr(totals.taxTotalNpr)}<br>Discounts: ${formatNpr(totals.discountTotalNpr)}<br><strong>Amount due: ${formatNpr(totals.amountDueNpr)}</strong>`;
  const footer = business.invoiceFooterNote ? `<p>${esc(business.invoiceFooterNote)}</p>` : "";
  const stay = invoice.reservationRef ? `Booking ${esc(invoice.reservationRef)}${invoice.checkIn && invoice.checkOut ? ` · ${esc(formatStayDate(invoice.checkIn))} – ${esc(formatStayDate(invoice.checkOut))} · ${invoice.nights ?? 0} nights` : ""}` : invoice.checkIn && invoice.checkOut ? `Stay: ${esc(formatStayDate(invoice.checkIn))} – ${esc(formatStayDate(invoice.checkOut))}` : "";
  const guestDetails = `${guest.email ? ` · ${esc(guest.email)}` : ""}${guest.phone ? ` · ${esc(guest.phone)}` : ""}${guest.address ? ` · ${esc(guest.address)}` : ""}${guest.country ? ` · ${esc(guest.country)}` : ""}`;
  const html = `<main style="max-width:820px;margin:auto;font:15px Arial,sans-serif;color:#283327"><header>${logo}${details}</header><hr style="border:0;border-top:1px solid #d9d4bf;margin:20px 0"><h1 style="font-size:24px">Invoice ${esc(invoice.number)}</h1><p>Invoice date: ${esc(formatStayDate(invoice.invoiceDate))}</p><p>${esc(guest.name)}${guestDetails}</p>${guest.referenceNote ? `<p>Reference: ${esc(guest.referenceNote)}</p>` : ""}${stay ? `<p>${stay}</p>` : ""}<table style="border-collapse:collapse;width:100%"><thead><tr><th style="text-align:left;padding:8px">Description</th><th style="text-align:right;padding:8px">Rate / night</th><th style="text-align:right;padding:8px">Nights</th><th style="text-align:right;padding:8px">Amount</th></tr></thead><tbody>${htmlRows}</tbody></table><p>${summary}</p><p>Payment status: ${esc(paymentStatus)}</p>${invoice.paymentNote ? `<p>Payment note: ${esc(invoice.paymentNote)}</p>` : ""}${footer}</main>`;
  const textRows = lines.map((line) => `${line.description} | ${line.ratePerNightNpr === null ? "—" : formatNpr(line.ratePerNightNpr)} | ${line.nights === null ? "—" : line.nights} | ${amountLabel(line)}`).join("\n");
  const text = `${business.name}\n${business.address ?? ""}\n${business.phones.join(" · ")}\n${business.emails.join(" · ")}${business.panVatNumber ? `\nPAN / VAT: ${business.panVatNumber}` : ""}\nInvoice ${invoice.number}\nInvoice date: ${formatStayDate(invoice.invoiceDate)}\nGuest: ${guest.name}${guest.email ? ` · ${guest.email}` : ""}${guest.phone ? ` · ${guest.phone}` : ""}${guest.address ? ` · ${guest.address}` : ""}${guest.country ? ` · ${guest.country}` : ""}${guest.referenceNote ? `\nReference: ${guest.referenceNote}` : ""}${invoice.reservationRef ? `\nBooking: ${invoice.reservationRef}` : ""}${invoice.checkIn && invoice.checkOut ? `\nStay: ${formatStayDate(invoice.checkIn)} – ${formatStayDate(invoice.checkOut)} (${invoice.nights ?? 0} nights)` : ""}\nDescription | Rate / night | Nights | Amount\n${textRows}\nSubtotal: ${formatNpr(totals.subtotalNpr)}\nTax: ${formatNpr(totals.taxTotalNpr)}\nDiscounts: ${formatNpr(totals.discountTotalNpr)}\nAmount due: ${formatNpr(totals.amountDueNpr)}\nPayment status: ${paymentStatus}${invoice.paymentNote ? `\nPayment note: ${invoice.paymentNote}` : ""}${business.invoiceFooterNote ? `\n${business.invoiceFooterNote}` : ""}`;
  return { subject: `Invoice ${invoice.number} · ${business.name}`, html, text };
}
