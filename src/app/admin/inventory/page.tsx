import Link from "next/link";
import { can, requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { listInventoryItems } from "@/lib/inventory/queries";
import { formatQuantityWithUnit, isLowStock } from "@/lib/inventory/stock";
import { PageHeader } from "@/components/admin/page-header";
import { StockBadge } from "@/components/admin/stock-badge";
import { buttonClasses } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";

export const metadata = { title: "Inventory" };

const PAGE_SIZE = 40;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePagePermission(ADMIN_SECTIONS.inventory.permission);
  const canManage = can(user.role, "inventory.manageItems");
  const sp = await searchParams;

  const q = first(sp.q).trim().slice(0, 80);
  const category = first(sp.category);
  const lowOnly = first(sp.low) === "1";
  const showArchived = canManage && first(sp.archived) === "1";
  const pageParam = Number(first(sp.page));
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const all = await listInventoryItems({ includeArchived: showArchived });
  const categories = [...new Set(all.map((item) => item.category))].sort((a, b) => a.localeCompare(b));
  const term = q.toLowerCase();
  const matches = all.filter(
    (item) =>
      (!category || item.category === category) &&
      (!lowOnly || isLowStock(item)) &&
      (!term || `${item.name} ${item.supplier ?? ""}`.toLowerCase().includes(term)),
  );
  const lowCount = all.filter(isLowStock).length;
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const shown = matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtered = Boolean(q || category || lowOnly || showArchived);

  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (lowOnly) params.set("low", "1");
    if (showArchived) params.set("archived", "1");
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return query ? `/admin/inventory?${query}` : "/admin/inventory";
  };

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Supplies on hand. Record usage and deliveries as they happen."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/inventory/record" className={buttonClasses()}>
              Record usage
            </Link>
            <Link href="/admin/inventory/move" className={buttonClasses({ variant: "secondary" })}>
              Move stock
            </Link>
            <Link href="/admin/inventory/locations" className={buttonClasses({ variant: "secondary" })}>
              Store and laundry
            </Link>
            <Link href="/admin/inventory/lost-damaged" className={buttonClasses({ variant: "secondary" })}>
              Lost / damaged
            </Link>
            {canManage && (
              <Link href="/admin/inventory/new" className={buttonClasses({ variant: "secondary" })}>
                New item
              </Link>
            )}
          </div>
        }
      />

      <form method="get" className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center" role="search">
        <Input type="search" name="q" defaultValue={q} placeholder="Search by name or supplier" aria-label="Search items" />
        <Select name="category" defaultValue={category} aria-label="Category" className="sm:w-48">
          <option value="">All categories</option>
          {categories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex min-h-10 items-center gap-2">
            <input type="checkbox" name="low" value="1" defaultChecked={lowOnly} className="size-4" />
            Low stock only ({lowCount})
          </label>
          {canManage && (
            <label className="flex min-h-10 items-center gap-2">
              <input type="checkbox" name="archived" value="1" defaultChecked={showArchived} className="size-4" />
              Show archived
            </label>
          )}
        </div>
        <div className="flex gap-2">
          <button type="submit" className={buttonClasses({ variant: "secondary" })}>
            Filter
          </button>
          {filtered && (
            <Link href="/admin/inventory" className={buttonClasses({ variant: "ghost" })}>
              Clear
            </Link>
          )}
        </div>
      </form>

      {matches.length === 0 ? (
        <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-8 text-center text-sm text-charcoal-light">
          {filtered
            ? "No items match these filters."
            : canManage
              ? "No items yet. Add the first one to start tracking stock."
              : "No items yet. An admin needs to add them first."}
        </p>
      ) : (
        <ul className="divide-y divide-forest/10 rounded-lg border border-forest/10 bg-white">
          {shown.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0">
                <Link
                  href={`/admin/inventory/${item.id}`}
                  className="font-medium text-forest underline-offset-4 hover:underline focus-visible:underline"
                >
                  {item.name}
                </Link>
                <p className="text-xs text-charcoal-light">
                  {item.category}
                  {item.supplier ? ` · ${item.supplier}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StockBadge item={item} />
                <span className="text-base font-medium whitespace-nowrap tabular-nums">
                  {formatQuantityWithUnit(item.quantity, item.unit)}
                </span>
                {item.isActive && (
                  <Link
                    href={`/admin/inventory/record?item=${item.id}`}
                    className={buttonClasses({ variant: "secondary", size: "sm", className: "min-h-10" })}
                  >
                    Record
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={pageHref(page - 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>Previous</Link> : <span />}
          <span className="text-charcoal-light">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={pageHref(page + 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>Next</Link> : <span />}
        </nav>
      )}
    </>
  );
}
