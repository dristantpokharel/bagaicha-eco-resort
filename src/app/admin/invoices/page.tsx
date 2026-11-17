import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { formatDateTime } from "@/lib/dates";
import { formatNpr } from "@/lib/money";
import { invoiceFilterSchema } from "@/lib/invoice/schemas";

export const metadata = { title: "Invoices" };

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const parseSnapshot = (value: unknown) => value as { name: string; email: string | null };
const methods = ["CASH", "CHEQUE", "FONEPAY", "ESEWA", "BANK_TRANSFER"] as const;

export default async function InvoiceListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const parsed = invoiceFilterSchema.safeParse({ status: first(raw.status), paymentMethod: first(raw.paymentMethod), from: first(raw.from), to: first(raw.to), q: first(raw.q) });
  const filters = parsed.success ? parsed.data : {};
  const issuedAt: { gte?: Date; lt?: Date } = {};
  if (filters.from) issuedAt.gte = new Date(`${filters.from}T00:00:00+05:45`);
  if (filters.to) issuedAt.lt = new Date(new Date(`${filters.to}T00:00:00+05:45`).getTime() + 86_400_000);
  const rows = await db.invoice.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
      ...(Object.keys(issuedAt).length ? { issuedAt } : {}),
    },
    orderBy: [{ issuedAt: "desc" }, { number: "desc" }],
  });
  const query = filters.q?.toLocaleLowerCase().trim();
  const invoices = query ? rows.filter((invoice) => {
    const guest = parseSnapshot(invoice.guestSnapshot);
    return [invoice.number, invoice.reservationRef, guest.name, guest.email ?? ""].some((value) => value.toLocaleLowerCase().includes(query));
  }) : rows;
  const hasFilters = Object.values(filters).some(Boolean);

  return <>
    <PageHeader title="Invoices" description="Issued invoices are saved as reservation snapshots." />
    <form method="get" role="search" className="mb-5 grid gap-3 rounded-md border border-forest/10 bg-white p-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
      <label className="text-sm font-medium">Status<Select name="status" defaultValue={filters.status ?? ""} className="mt-1"><option value="">All statuses</option><option value="ISSUED">Issued</option><option value="PAID">Paid</option><option value="VOID">Void</option></Select></label>
      <label className="text-sm font-medium">Payment method<Select name="paymentMethod" defaultValue={filters.paymentMethod ?? ""} className="mt-1"><option value="">All methods</option>{methods.map((method) => <option key={method} value={method}>{method.replaceAll("_", " ")}</option>)}</Select></label>
      <label className="text-sm font-medium">Issued from<Input type="date" name="from" defaultValue={filters.from} className="mt-1" /></label>
      <label className="text-sm font-medium">Issued to<Input type="date" name="to" defaultValue={filters.to} className="mt-1" /></label>
      <label className="text-sm font-medium lg:col-span-2">Invoice, guest, or booking reference<Input name="q" defaultValue={filters.q} className="mt-1" placeholder="Search invoices" /></label>
      <div className="flex gap-2 lg:col-span-6"><button type="submit" className={buttonClasses({ variant: "secondary" })}>Filter</button>{hasFilters && <Link href="/admin/invoices" className={buttonClasses({ variant: "ghost" })}>Clear</Link>}</div>
    </form>
    {invoices.length === 0 ? <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-8 text-center text-sm text-charcoal-light">No invoices match these filters.</p> : <div className="overflow-x-auto rounded-lg border border-forest/10 bg-white">
      <table className="w-full min-w-[740px] text-left text-sm"><thead className="border-b border-forest/10 text-xs uppercase tracking-wide text-charcoal-light"><tr>{["Invoice", "Guest", "Booking", "Issued", "Status", "Amount sent"].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-forest/10">{invoices.map((invoice) => { const guest = parseSnapshot(invoice.guestSnapshot); return <tr key={invoice.id}>
          <td className="px-4 py-3"><Link href={`/admin/invoices/${invoice.id}`} className="font-medium text-forest underline underline-offset-4">{invoice.number}</Link></td>
          <td className="px-4 py-3">{guest.name}</td><td className="px-4 py-3"><Link href={`/admin/bookings/${invoice.reservationId}`} className="text-forest underline underline-offset-4">{invoice.reservationRef}</Link></td>
          <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(invoice.issuedAt)}</td><td className="px-4 py-3">{invoice.status}{invoice.paymentMethod ? ` · ${invoice.paymentMethod.replaceAll("_", " ")}` : ""}</td><td className="px-4 py-3 whitespace-nowrap">{formatNpr(invoice.grandTotalNpr)}</td>
        </tr>; })}</tbody>
      </table>
    </div>}
  </>;
}
