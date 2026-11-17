import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission, can } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { formatStayDate } from "@/lib/booking/dates";
import { formatNpr } from "@/lib/money";
import { SITE } from "@/config/site";
import { Logo } from "@/components/brand/logo";
import { PageHeader } from "@/components/admin/page-header";
import { buttonClasses } from "@/components/ui/button";
import { InvoiceControls } from "../invoice-controls";

export const metadata = { title: "Invoice" };

type Guest = { name: string; email: string | null; phone: string | null; country: string | null };
type RoomLine = {
  roomTypeName: string; roomName: string | null; standardRateNpr: number; discountedRateNpr: number; childRateNpr: number;
  children: number; nights: number; childChargeNpr: number; standardTotalNpr: number; discountedTotalNpr: number; discountNpr: number;
};
type ExtraLine = { name: string; unit: string; quantity: number; priceNpr: number; totalNpr: number };

function displayPaymentMethod(method: string | null) {
  return method?.replaceAll("_", " ") ?? "";
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePagePermission("invoices.view");
  const { id } = await params;
  const [invoice, business] = await Promise.all([
    db.invoice.findUnique({ where: { id } }),
    db.businessInfo.findUnique({ where: { id: 1 } }),
  ]);
  if (!invoice) notFound();
  const guest = invoice.guestSnapshot as Guest;
  const roomLines = invoice.roomLines as RoomLine[];
  const extraLines = invoice.extraLines as ExtraLine[];
  const panVat = business?.panVatNumber && !business.placeholderFields.includes("panVatNumber") ? business.panVatNumber : null;
  const footerNote = business?.invoiceFooterNote && !business.placeholderFields.includes("invoiceFooterNote") ? business.invoiceFooterNote : null;
  const businessName = business?.name || SITE.name;
  const businessAddress = business?.address || SITE.address;
  const phones = business?.phones ?? [];
  const emails = business?.emails ?? [];
  const invoiceStatus = invoice.status === "PAID" ? "PAID" : invoice.status === "VOID" ? "VOID" : "ISSUED";

  return <>
    <div className="print:hidden">
      <p className="mb-2 text-sm"><Link href="/admin/invoices" className="text-forest underline underline-offset-4">← All invoices</Link></p>
      <PageHeader title={invoice.number} description={`Issued ${formatDateTime(invoice.issuedAt)} · Booking ${invoice.reservationRef}`} />
      <InvoiceControls invoiceId={invoice.id} status={invoiceStatus} canManage={can(user.role, "invoices.issue")} />
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link href={`/admin/bookings/${invoice.reservationId}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>Open reservation</Link>
        {invoice.status === "VOID" && <Link href={`/admin/bookings/${invoice.reservationId}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>Issue replacement</Link>}
      </div>
    </div>

    <article className="invoice-print mx-auto mt-6 max-w-3xl border border-forest/15 bg-white p-5 text-charcoal shadow-subtle sm:p-10 print:mt-0 print:max-w-none print:border-0 print:p-0 print:shadow-none">
      {invoice.status === "VOID" && <div className="mb-5 border-2 border-error p-2 text-center font-bold tracking-[0.2em] text-error">VOID</div>}
      <header className="flex flex-col justify-between gap-5 border-b border-forest/20 pb-5 sm:flex-row sm:items-start">
        <div>
          <Logo art="wordmark" alt={businessName} className="mb-3 h-14 w-auto" />
          <h2 className="font-semibold text-forest">{businessName}</h2>
          <p className="mt-1 text-sm">{businessAddress}</p>
          {phones.map((phone) => <p key={phone} className="text-sm">{phone}</p>)}
          {emails.map((email) => <p key={email} className="text-sm">{email}</p>)}
          {panVat && <p className="mt-1 text-sm">PAN / VAT: {panVat}</p>}
        </div>
        <div className="sm:text-right">
          <h1 className="font-display text-3xl text-forest">Invoice</h1>
          <p className="mt-2 font-semibold">{invoice.number}</p>
          <p className="text-sm">Issued: {formatDateTime(invoice.issuedAt)}</p>
          <p className="text-sm">Status: {invoice.status}</p>
          {invoice.paymentMethod && <p className="text-sm">Payment: {displayPaymentMethod(invoice.paymentMethod)}</p>}
          {invoice.paidAt && <p className="text-sm">Paid: {formatStayDate(invoice.paidAt)}</p>}
          {invoice.paymentNote && <p className="text-sm">Note: {invoice.paymentNote}</p>}
        </div>
      </header>

      <section className="grid gap-5 border-b border-forest/20 py-5 sm:grid-cols-2">
        <div><h2 className="text-xs font-semibold uppercase tracking-wider text-charcoal-light">Billed to</h2><p className="mt-1 font-semibold">{guest.name}</p>{guest.email && <p className="text-sm">{guest.email}</p>}{guest.phone && <p className="text-sm">{guest.phone}</p>}{guest.country && <p className="text-sm">{guest.country}</p>}</div>
        <div><h2 className="text-xs font-semibold uppercase tracking-wider text-charcoal-light">Stay details</h2><p className="mt-1">Booking reference: {invoice.reservationRef}</p><p className="text-sm">Check-in: {formatStayDate(invoice.checkIn)}</p><p className="text-sm">Check-out: {formatStayDate(invoice.checkOut)}</p><p className="text-sm">Nights: {invoice.nights}</p></div>
      </section>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-forest/20 text-xs uppercase tracking-wide text-charcoal-light"><tr><th className="py-3 pr-3">Description</th><th className="py-3 px-2 text-right">Standard / night</th><th className="py-3 px-2 text-right">Discounted / night</th><th className="py-3 px-2 text-right">Discount / night</th><th className="py-3 pl-2 text-right">Line total</th></tr></thead>
          <tbody className="divide-y divide-forest/10">{roomLines.map((line, index) => <tr key={`${line.roomTypeName}-${index}`}>
            <td className="py-3 pr-3"><span className="font-medium">{line.roomTypeName}{line.roomName ? ` · ${line.roomName}` : ""}</span><span className="block text-xs text-charcoal-light">{line.nights} night{line.nights === 1 ? "" : "s"}{line.children > 0 ? ` · ${line.children} child${line.children === 1 ? "" : "ren"} · Child charge ${formatNpr(line.childChargeNpr)}` : ""}</span></td>
            <td className="px-2 py-3 text-right align-top">{formatNpr(line.standardRateNpr)}</td><td className="px-2 py-3 text-right align-top">{formatNpr(line.discountedRateNpr)}</td><td className="px-2 py-3 text-right align-top">{formatNpr(line.standardRateNpr - line.discountedRateNpr)}</td><td className="py-3 pl-2 text-right align-top font-medium">{formatNpr(line.discountedTotalNpr)}</td>
          </tr>)}
          {extraLines.map((line, index) => <tr key={`${line.name}-${index}`}><td className="py-3 pr-3"><span className="font-medium">{line.name}</span><span className="block text-xs text-charcoal-light">{line.quantity} {line.unit}</span></td><td className="px-2 py-3 text-right">—</td><td className="px-2 py-3 text-right">—</td><td className="px-2 py-3 text-right">—</td><td className="py-3 pl-2 text-right font-medium">{line.totalNpr > 0 ? formatNpr(line.totalNpr) : "Included"}</td></tr>)}
          </tbody>
        </table>
      </div>
      <section className="ml-auto mt-5 grid max-w-sm grid-cols-2 gap-x-6 gap-y-2 border-t border-forest/20 pt-4 text-sm">
        <span>Subtotal at standard rates</span><span className="text-right">{formatNpr(invoice.standardSubtotalNpr)}</span>
        <span>Total discount</span><span className="text-right">{formatNpr(invoice.discountTotalNpr)}</span>
        <span className="border-t border-forest/20 pt-2 text-base font-semibold">Amount sent</span><span className="border-t border-forest/20 pt-2 text-right text-base font-semibold">{formatNpr(invoice.grandTotalNpr)}</span>
      </section>
      {invoice.status === "VOID" && invoice.voidReason && <p className="mt-5 border border-error/25 bg-error/5 p-3 text-sm"><strong>Void reason:</strong> {invoice.voidReason}</p>}
      {footerNote && <footer className="mt-8 border-t border-forest/20 pt-4 text-center text-sm">{footerNote}</footer>}
    </article>
  </>;
}
