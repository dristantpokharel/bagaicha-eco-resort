import Link from "next/link";
import { requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { listLocations, listReusableItemsWithBalances } from "@/lib/inventory/queries";
import { PageHeader } from "@/components/admin/page-header";
import { PlaceForm } from "../place-form";

export const metadata = { title: "Move stock" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function MoveStockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission(ADMIN_SECTIONS.inventory.permission);
  const sp = await searchParams;
  const [items, locations] = await Promise.all([listReusableItemsWithBalances(), listLocations()]);
  const defaultItemId = items.find((item) => item.id === first(sp.item))?.id;
  const defaultFromId = defaultItemId && locations.find((place) => place.id === first(sp.from))?.id;

  return (
    <>
      <PageHeader title="Move stock" description="Shift reusable items between the Store, the Laundry and rooms." />
      <div className="max-w-xl">
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-8 text-center text-sm text-charcoal-light">
            No reusable items yet. Mark an item as reusable on its page.
          </p>
        ) : (
          <div className="rounded-lg border border-forest/10 bg-white p-4 sm:p-6">
            <PlaceForm mode="move" items={items} places={locations} defaultItemId={defaultItemId} defaultFromId={defaultFromId || undefined} />
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
