import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/admin/page-header";
import { StandaloneInvoiceForm } from "../standalone-form";

export const metadata = { title: "New standalone invoice" };

export default async function NewStandaloneInvoicePage() {
  await requirePagePermission("invoices.issue");
  const guests = await db.guest.findMany({ orderBy: { name: "asc" }, take: 300, select: { id: true, name: true, phone: true, email: true, country: true } });
  return <>
    <PageHeader title="Standalone invoice" description="Issue an invoice without a reservation. All details are saved as an invoice snapshot." />
    <StandaloneInvoiceForm guests={guests.map((guest) => ({ ...guest, address: null }))} />
  </>;
}
