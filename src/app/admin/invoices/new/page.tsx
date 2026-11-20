import Link from "next/link";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { buttonClasses } from "@/components/ui/button";
import { BILLABLE_BOOKING_STATUSES } from "@/lib/invoice/service";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage() {
  await requirePagePermission("invoices.issue");
  const reservations = await db.reservation.findMany({
    where: { bookings: { some: { status: { in: [...BILLABLE_BOOKING_STATUSES] } } } },
    orderBy: { checkIn: "desc" }, take: 100,
    select: { id: true, reference: true, guestName: true, checkIn: true, checkOut: true, bookings: { where: { status: { in: [...BILLABLE_BOOKING_STATUSES] } }, select: { id: true } }, invoices: { where: { status: { not: "VOID" } }, take: 1, select: { id: true } } },
  });
  return <>
    <PageHeader title="New invoice" description="Choose an invoice source." />
    <section className="mb-6 grid gap-4 sm:grid-cols-2">
      <div className="rounded-lg border border-forest/15 bg-white p-5"><h2 className="font-semibold">From a reservation</h2><p className="my-2 text-sm text-charcoal-light">Copy current guest, stay, room, and extra details into an invoice.</p><p className="text-xs text-charcoal-light">Only reservations with Confirmed, Checked-in, or Checked-out rooms can be issued.</p></div>
      <div className="rounded-lg border border-forest/15 bg-white p-5"><h2 className="font-semibold">Standalone</h2><p className="my-2 text-sm text-charcoal-light">Create an invoice for a bill-to contact without requiring a reservation.</p><Link href="/admin/invoices/new/standalone" className={buttonClasses({ variant: "primary" })}>Create standalone invoice</Link></div>
    </section>
    {reservations.length === 0 ? <p className="rounded-md border border-dashed border-forest/30 bg-white p-6 text-sm text-charcoal-light">There are no eligible reservations to invoice.</p> : <div className="overflow-x-auto rounded-lg border border-forest/10 bg-white"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-forest/10 text-xs uppercase text-charcoal-light"><tr><th className="px-4 py-3">Reservation</th><th className="px-4 py-3">Guest</th><th className="px-4 py-3">Stay</th><th className="px-4 py-3">Billable rooms</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-forest/10">{reservations.map((reservation) => <tr key={reservation.id}><td className="px-4 py-3">{reservation.reference}</td><td className="px-4 py-3">{reservation.guestName}</td><td className="px-4 py-3">{reservation.checkIn.toISOString().slice(0, 10)} – {reservation.checkOut.toISOString().slice(0, 10)}</td><td className="px-4 py-3">{reservation.bookings.length}</td><td className="px-4 py-3 text-right">{reservation.invoices[0] ? <Link href={`/admin/invoices/${reservation.invoices[0].id}`} className="text-forest underline underline-offset-4">Open existing invoice</Link> : <Link href={`/admin/bookings/${reservation.id}`} className="text-forest underline underline-offset-4">Open to issue</Link>}</td></tr>)}</tbody></table></div>}
  </>;
}
