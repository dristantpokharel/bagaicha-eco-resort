import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { can, requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { formatDateTime } from "@/lib/dates";
import { formatNpr } from "@/lib/money";
import { SUGGESTED_CATEGORIES } from "@/config/inventory";
import { listCategories, listLocations } from "@/lib/inventory/queries";
import { MOVEMENT_LABELS } from "@/lib/inventory/labels";
import { formatQuantity, formatQuantityWithUnit } from "@/lib/inventory/stock";
import { PageHeader } from "@/components/admin/page-header";
import { StockBadge } from "@/components/admin/stock-badge";
import { buttonClasses } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { ArchiveForm } from "../archive-form";
import { ItemForm } from "../item-form";
import { MovementForm } from "../movement-form";

const HISTORY_PAGE_SIZE = 25;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await db.inventoryItem.findUnique({ where: { id }, select: { name: true } });
  return { title: item?.name ?? "Inventory item" };
}

export default async function InventoryItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePagePermission(ADMIN_SECTIONS.inventory.permission);
  const canManage = can(user.role, "inventory.manageItems");
  const { id } = await params;
  const sp = await searchParams;
  const pageParam = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const item = await db.inventoryItem.findUnique({ where: { id } });
  if (!item) notFound();

  const [movements, movementCount, existingCategories, locations, balances] = await Promise.all([
    db.stockMovement.findMany({
      where: { itemId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * HISTORY_PAGE_SIZE,
      take: HISTORY_PAGE_SIZE,
      include: { user: { select: { name: true } } },
    }),
    db.stockMovement.count({ where: { itemId: id } }),
    canManage ? listCategories() : Promise.resolve([]),
    item.isConsumable ? Promise.resolve([]) : listLocations(),
    item.isConsumable ? Promise.resolve([]) : db.stockBalance.findMany({ where: { itemId: id } }),
  ]);
  const balanceAt = Object.fromEntries(balances.map((b) => [b.locationId, b.quantity.toString()]));
  const holdings = locations.filter((place) => (balanceAt[place.id] ?? "0") !== "0" && Number(balanceAt[place.id]) !== 0);
  const placeName = new Map(locations.map((place) => [place.id, place.label]));
  const pages = Math.max(1, Math.ceil(movementCount / HISTORY_PAGE_SIZE));
  const created = (Array.isArray(sp.created) ? sp.created[0] : sp.created) === "1";
  const categories = [...new Set([...existingCategories, ...SUGGESTED_CATEGORIES])].sort((a, b) => a.localeCompare(b));

  return (
    <>
      <PageHeader
        title={item.name}
        description={`${item.category} · ${item.isActive ? "Active" : "Archived"}`}
        actions={
          <Link href="/admin/inventory" className={buttonClasses({ variant: "secondary" })}>
            All items
          </Link>
        }
      />
      {created && (
        <div className="mb-4">
          <FormMessage type="success">Item added.</FormMessage>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-lg border border-forest/10 bg-white p-5" aria-label="Stock">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <p className="font-display text-3xl text-forest tabular-nums">{formatQuantityWithUnit(item.quantity, item.unit)}</p>
            <StockBadge item={item} />
          </div>
          <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-charcoal-light">Low-stock threshold</dt>
            <dd>{item.lowStockThreshold.isZero() ? "No alert" : formatQuantityWithUnit(item.lowStockThreshold, item.unit)}</dd>
            <dt className="text-charcoal-light">Kind</dt>
            <dd>
              {item.isConsumable ? "Consumable" : "Reusable"}
              {!item.isConsumable && ` · ${item.isFixedInRoom ? "stays in the room" : "goes to laundry at checkout"}`}
            </dd>
            <dt className="text-charcoal-light">Unit cost</dt>
            <dd>{item.unitCostNpr === null ? "Not set" : formatNpr(item.unitCostNpr)}</dd>
            <dt className="text-charcoal-light">Supplier</dt>
            <dd>{item.supplier ?? "Not set"}</dd>
          </dl>

          {!item.isConsumable && (
            <div className="mb-5">
              <h2 className="mb-2 font-display text-lg text-forest">Where it is</h2>
              {holdings.length === 0 ? (
                <p className="text-sm text-charcoal-light">None on hand.</p>
              ) : (
                <ul className="divide-y divide-forest/10 rounded-md border border-forest/10 text-sm">
                  {holdings.map((place) => (
                    <li key={place.id} className="flex items-center justify-between px-3 py-2">
                      <span>{place.label}</span>
                      <span className="tabular-nums">{formatQuantityWithUnit(balanceAt[place.id], item.unit)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {item.isActive && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/admin/inventory/move?item=${item.id}`} className={buttonClasses({ variant: "secondary", size: "sm", className: "min-h-10" })}>
                    Move
                  </Link>
                  <Link href={`/admin/inventory/lost-damaged?item=${item.id}`} className={buttonClasses({ variant: "secondary", size: "sm", className: "min-h-10" })}>
                    Lost / damaged
                  </Link>
                </div>
              )}
            </div>
          )}

          {item.isActive ? (
            <>
              <h2 className="mb-3 font-display text-lg text-forest">Record stock</h2>
              <MovementForm
                items={[
                  {
                    id: item.id,
                    name: item.name,
                    category: item.category,
                    unit: item.unit,
                    quantity: item.quantity.toString(),
                    isConsumable: item.isConsumable,
                    balances: balanceAt,
                  },
                ]}
                types={item.isConsumable ? ["USED", "RECEIVED", "ADJUSTED"] : ["RECEIVED", "ADJUSTED"]}
                defaultType={item.isConsumable ? "USED" : "RECEIVED"}
                locations={locations.filter((place) => place.isActive || (balanceAt[place.id] ?? "0") !== "0").map((place) => ({ id: place.id, label: place.label, isStore: place.kind === "STORE" }))}
              />
            </>
          ) : (
            <p className="text-sm text-charcoal-light">This item is archived. Make it active again to record stock.</p>
          )}
        </section>

        {canManage && (
          <section className="rounded-lg border border-forest/10 bg-white p-5" aria-label="Item details">
            <h2 className="mb-3 font-display text-lg text-forest">Edit item</h2>
            <ItemForm
              categories={categories}
              item={{
                id: item.id,
                name: item.name,
                category: item.category,
                unit: item.unit,
                lowStockThreshold: formatQuantity(item.lowStockThreshold),
                unitCostNpr: item.unitCostNpr,
                supplier: item.supplier,
                isConsumable: item.isConsumable,
                isFixedInRoom: item.isFixedInRoom,
                hasMovements: movementCount > 0,
              }}
            />
            <div className="mt-6 border-t border-forest/10 pt-4">
              <ArchiveForm itemId={item.id} isActive={item.isActive} />
            </div>
          </section>
        )}
      </div>

      <section className="mt-6 rounded-lg border border-forest/10 bg-white p-5" aria-label="Movement history">
        <h2 className="mb-3 font-display text-lg text-forest">
          History <span className="text-sm font-normal text-charcoal-light">({movementCount})</span>
        </h2>
        {movements.length === 0 ? (
          <p className="text-sm text-charcoal-light">No movements yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-forest/10 text-xs tracking-wide text-charcoal-light uppercase">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">When</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Who</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Type</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Change</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Total after</th>
                  {!item.isConsumable && <th scope="col" className="py-2 pr-4 font-medium">Place</th>}
                  <th scope="col" className="py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest/10">
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 pr-4 whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                    <td className="py-2 pr-4">{m.user.name}</td>
                    <td className="py-2 pr-4">{MOVEMENT_LABELS[m.type]}</td>
                    <td className={`py-2 pr-4 text-right whitespace-nowrap tabular-nums ${m.type === "TRANSFERRED" ? "text-charcoal-light" : m.quantity.isNegative() ? "text-error" : "text-success"}`}>
                      {m.type === "TRANSFERRED" ? "" : m.quantity.isNegative() ? "−" : "+"}
                      {formatQuantity(m.quantity.abs())} {item.unit}
                    </td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap tabular-nums">{formatQuantityWithUnit(m.balanceAfter, item.unit)}</td>
                    {!item.isConsumable && (
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {m.fromLocationId && m.toLocationId
                          ? `${placeName.get(m.fromLocationId) ?? "?"} → ${placeName.get(m.toLocationId) ?? "?"}`
                          : (placeName.get(m.fromLocationId ?? m.toLocationId ?? "") ?? "")}
                      </td>
                    )}
                    <td className="py-2 text-charcoal-light">{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <nav aria-label="History pages" className="mt-4 flex items-center justify-between text-sm">
            {page > 1 ? <Link href={`?page=${page - 1}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>Newer</Link> : <span />}
            <span className="text-charcoal-light">Page {page} of {pages}</span>
            {page < pages ? <Link href={`?page=${page + 1}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>Older</Link> : <span />}
          </nav>
        )}
      </section>
    </>
  );
}
