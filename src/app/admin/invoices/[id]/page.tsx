import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission, can } from "@/lib/auth";
import { formatStayDate } from "@/lib/booking/dates";
import { formatNpr } from "@/lib/money";
import { SITE } from "@/config/site";
import { Logo } from "@/components/brand/logo";
import { PageHeader } from "@/components/admin/page-header";
import { buttonClasses } from "@/components/ui/button";
import { InvoiceControls } from "../invoice-controls";
import { LinkReservationForm } from "../link-reservation-form";
import { invoiceDisplayLines, invoiceDisplayTotals } from "@/lib/invoice/lines";

export const metadata = { title: "Invoice" };

type Guest = { name: string; email: string | null; phone: string | null; country: string | null; address?: string | null; referenceNote?: string | null };
function displayPaymentMethod(method: string | null) { return method?.replaceAll("_", " ") ?? ""; }

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("invoices.view");
  const { id } = await params;
  const [invoice, business] = await Promise.all([db.invoice.findUnique({ where: { id } }), db.businessInfo.findUnique({ where: { id: 1 } })]);
  if (!invoice) notFound();
  const guest = invoice.guestSnapshot as Guest;
  const linkedReservation = invoice.linkedReservationId ? await db.reservation.findUnique({ where: { id: invoice.linkedReservationId }, select: { id: true, reference: true } }) : null;
  const lines = invoiceDisplayLines(invoice);
  const totals = invoiceDisplayTotals(invoice);
  const staff = can(user.role, "invoices.issue");
  const panVat = business?.panVatNumber && !business.placeholderFields.includes("panVatNumber") ? business.panVatNumber : null;
  const footerNote = business?.invoiceFooterNote && !business.placeholderFields.includes("invoiceFooterNote") ? business.invoiceFooterNote : null;
  const businessName = business?.name || SITE.name;
  const businessAddress = business?.address || SITE.address;

  return <>
    <div className="print:hidden">
      <p className="mb-2 text-sm"><Link href="/admin/invoices" className="text-forest underline underline-offset-4">← All invoices</Link></p>
      <PageHeader title={invoice.number} description={`Invoice date ${formatStayDate(invoice.invoiceDate)}${invoice.reservationRef ? ` · Booking ${invoice.reservationRef}` : " · Standalone"}`} />
      <InvoiceControls invoiceId={invoice.id} status={invoice.status} canManage={staff} />
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {invoice.reservationId && <Link href={`/admin/bookings/${invoice.reservationId}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>Open reservation</Link>}
        {invoice.status === "VOID" && invoice.reservationId && <Link href={`/admin/bookings/${invoice.reservationId}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>Issue replacement</Link>}
        {invoice.status === "VOID" && !invoice.reservationId && <Link href="/admin/invoices/new/standalone" className={buttonClasses({ variant: "secondary", size: "sm" })}>Issue standalone replacement</Link>}
        {linkedReservation && <Link href={`/admin/bookings/${linkedReservation.id}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>Linked reservation {linkedReservation.reference}</Link>}
      </div>
      {!invoice.reservationId && !invoice.linkedReservationId && invoice.status === "ISSUED" && staff && <div className="mt-3"><LinkReservationForm invoiceId={invoice.id} reservations={await db.reservation.findMany({ orderBy: { checkIn: "desc" }, take: 100, select: { id: true, reference: true, guestName: true } })} /></div>}
    </div>
    <article className="invoice-print mx-auto mt-6 max-w-3xl border border-forest/15 bg-white p-5 text-charcoal shadow-subtle sm:p-10 print:mt-0 print:max-w-none print:border-0 print:p-0 print:shadow-none">
      {invoice.status === "VOID" && <div className="mb-5 border-2 border-error p-2 text-center font-bold tracking-[0.2em] text-error">VOID</div>}
      <header className="flex flex-col justify-between gap-5 border-b border-forest/20 pb-5 sm:flex-row sm:items-start">
        <div><Logo art="wordmark" alt={businessName} className="mb-3 h-14 w-auto" /><h2 className="font-semibold text-forest">{businessName}</h2><p className="mt-1 text-sm">{businessAddress}</p>{(business?.phones ?? []).map((phone) => <p key={phone} className="text-sm">{phone}</p>)}{(business?.emails ?? []).map((email) => <p key={email} className="text-sm">{email}</p>)}{panVat && <p className="mt-1 text-sm">PAN / VAT: {panVat}</p>}</div>
        <div className="sm:text-right"><h1 className="font-display text-3xl text-forest">Invoice</h1><p className="mt-2 font-semibold">{invoice.number}</p><p className="text-sm">Invoice date: {formatStayDate(invoice.invoiceDate)}</p><p className="text-sm">Status: {invoice.status}</p>{invoice.paymentMethod && <p className="text-sm">Payment: {displayPaymentMethod(invoice.paymentMethod)}</p>}{invoice.paidAt && <p className="text-sm">Paid: {formatStayDate(invoice.paidAt)}</p>}{invoice.paymentNote && <p className="text-sm">Note: {invoice.paymentNote}</p>}</div>
      </header>
      <section className="grid gap-5 border-b border-forest/20 py-5 sm:grid-cols-2">
        <div><h2 className="text-xs font-semibold uppercase tracking-wider text-charcoal-light">Billed to</h2><p className="mt-1 font-semibold">{guest.name}</p>{guest.email && <p className="text-sm">{guest.email}</p>}{guest.phone && <p className="text-sm">{guest.phone}</p>}{guest.address && <p className="text-sm">{guest.address}</p>}{guest.country && <p className="text-sm">{guest.country}</p>}{guest.referenceNote && <p className="mt-2 text-sm">Reference: {guest.referenceNote}</p>}</div>
        {(invoice.reservationRef || invoice.checkIn || invoice.checkOut || linkedReservation) && <div><h2 className="text-xs font-semibold uppercase tracking-wider text-charcoal-light">Stay details</h2>{invoice.reservationRef && <p className="mt-1">Booking reference: {invoice.reservationRef}</p>}{linkedReservation && <p className="mt-1">Linked reservation: {linkedReservation.reference}</p>}{invoice.checkIn && <p className="text-sm">Check-in: {formatStayDate(invoice.checkIn)}</p>}{invoice.checkOut && <p className="text-sm">Check-out: {formatStayDate(invoice.checkOut)}</p>}{invoice.nights && invoice.nights > 0 && <p className="text-sm">Nights: {invoice.nights}</p>}</div>}
      </section>
      <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="border-b border-forest/20 text-xs uppercase tracking-wide text-charcoal-light"><tr><th className="py-3 pr-3">Description</th><th className="px-2 py-3 text-right">Rate / night</th><th className="px-2 py-3 text-right">Nights</th><th className="py-3 pl-2 text-right">Amount</th></tr></thead>
        <tbody className="divide-y divide-forest/10">{lines.map((line) => <tr key={line.id}><td className="py-3 pr-3"><span className="font-medium">{line.description}</span>{staff && line.type === "ROOM" && <span className="print:hidden block text-xs text-charcoal-light">Standard {formatNpr(line.standardRateNpr ?? 0)}</span>}</td><td className="px-2 py-3 text-right align-top">{line.ratePerNightNpr === null ? "—" : formatNpr(line.ratePerNightNpr)}</td><td className="px-2 py-3 text-right align-top">{line.nights ?? "—"}</td><td className="py-3 pl-2 text-right align-top font-medium">{line.included ? "Included" : line.type === "DISCOUNT" ? `−${formatNpr(line.amountNpr)}` : formatNpr(line.amountNpr)}</td></tr>)}</tbody>
      </table></div>
      <section className="ml-auto mt-5 grid max-w-sm grid-cols-2 gap-x-6 gap-y-2 border-t border-forest/20 pt-4 text-sm"><span>Subtotal</span><span className="text-right">{formatNpr(totals.subtotalNpr)}</span><span>Tax</span><span className="text-right">{formatNpr(totals.taxTotalNpr)}</span><span>Discounts</span><span className="text-right">{formatNpr(totals.discountTotalNpr)}</span><span className="border-t border-forest/20 pt-2 text-base font-semibold">Amount due</span><span className="border-t border-forest/20 pt-2 text-right text-base font-semibold">{formatNpr(totals.amountDueNpr)}</span></section>
      {invoice.status === "VOID" && invoice.voidReason && <p className="mt-5 border border-error/25 bg-error/5 p-3 text-sm"><strong>Void reason:</strong> {invoice.voidReason}</p>}{footerNote && <footer className="mt-8 border-t border-forest/20 pt-4 text-center text-sm">{footerNote}</footer>}
    </article>
  </>;
}
