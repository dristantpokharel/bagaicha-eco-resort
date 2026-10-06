import Link from "next/link";
import { requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { listInventoryItems } from "@/lib/inventory/queries";
import { PageHeader } from "@/components/admin/page-header";
import { MovementForm } from "../movement-form";

export const metadata = { title: "Record stock" };

export default async function RecordStockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission(ADMIN_SECTIONS.inventory.permission);
  const sp = await searchParams;
  const itemParam = Array.isArray(sp.item) ? sp.item[0] : sp.item;

  const items = await listInventoryItems();
  const options = items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    unit: item.unit,
    quantity: item.quantity.toString(),
  }));
  const defaultItemId = options.find((item) => item.id === itemParam)?.id;

  return (
    <>
      <PageHeader title="Record stock" description="Log what was used, or a delivery that arrived." />
      <div className="max-w-xl">
        {options.length === 0 ? (
          <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-8 text-center text-sm text-charcoal-light">
            No active items yet. An admin needs to add items first.
          </p>
        ) : (
          <div className="rounded-lg border border-forest/10 bg-white p-4 sm:p-6">
            <MovementForm items={options} types={["USED", "RECEIVED"]} defaultType="USED" defaultItemId={defaultItemId} />
          </div>
        )}
        <p className="mt-4 text-sm">
          <Link href="/admin/inventory" className="text-forest underline underline-offset-4">
            Back to inventory
          </Link>
        </p>
      </div>
    </>
  );
}
