import Link from "next/link";
import { requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { formatQuantity } from "@/lib/inventory/format";
import { listLocations, listLocationStock } from "@/lib/inventory/queries";
import { PageHeader } from "@/components/admin/page-header";
import { buttonClasses } from "@/components/ui/button";
import { WashedForm } from "../washed-form";

export const metadata = { title: "Store and laundry" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission(ADMIN_SECTIONS.inventory.permission);
  const sp = await searchParams;

  const places = (await listLocations()).filter((place) => place.kind !== "ROOM");
  const current = places.find((place) => place.kind === (first(sp.where) === "laundry" ? "LAUNDRY" : "STORE"));
  if (!current) throw new Error("Store and Laundry locations are missing. Run the database migrations.");
  const stock = await listLocationStock(current.id);
  const isLaundry = current.kind === "LAUNDRY";

  const byCategory = new Map<string, typeof stock>();
  for (const row of stock) byCategory.set(row.category, [...(byCategory.get(row.category) ?? []), row]);

  return (
    <>
      <PageHeader
        title="Store and laundry"
        description="Where reusable items are right now. Rooms get their own view later."
        actions={
          <Link href="/admin/inventory/move" className={buttonClasses()}>
            Move stock
          </Link>
        }
      />

      <nav aria-label="Location" className="mb-5 grid max-w-sm grid-cols-2 gap-2">
        {places.map((place) => (
          <Link
            key={place.id}
            href={place.kind === "LAUNDRY" ? "?where=laundry" : "?where=store"}
            aria-current={place.id === current.id ? "page" : undefined}
            className={`flex min-h-12 items-center justify-center rounded-md border px-3 text-base font-medium ${
              place.id === current.id ? "border-forest bg-forest text-cream" : "border-charcoal/25 bg-white text-charcoal"
            }`}
          >
            {place.label}
          </Link>
        ))}
      </nav>

      {stock.length === 0 ? (
        <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-8 text-center text-sm text-charcoal-light">
          {isLaundry ? "Nothing in the laundry." : "Nothing in the Store yet. Receive reusable items to put them here."}
        </p>
      ) : isLaundry ? (
        <WashedForm rows={stock.map((row) => ({ id: row.id, name: row.name, unit: row.unit, quantity: row.quantity.toString() }))} />
      ) : (
        <div className="space-y-5">
          {[...byCategory].map(([category, rows]) => (
            <section key={category} aria-label={category}>
              <h2 className="mb-2 font-display text-lg text-forest">{category}</h2>
              <ul className="divide-y divide-forest/10 rounded-lg border border-forest/10 bg-white">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <Link href={`/admin/inventory/${row.id}`} className="font-medium text-forest underline-offset-4 hover:underline">
                      {row.name}
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="font-medium whitespace-nowrap tabular-nums">
                        {formatQuantity(row.quantity)} {row.unit}
                      </span>
                      <Link
                        href={`/admin/inventory/move?item=${row.id}&from=${current.id}`}
                        className={buttonClasses({ variant: "secondary", size: "sm", className: "min-h-10" })}
                      >
                        Move
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
