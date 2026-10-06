import Link from "next/link";
import { db } from "@/lib/db";
import { can, requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { formatDateTime } from "@/lib/dates";
import { ACTIVITY_PAGE_SIZE, activityWhere, parseActivityFilters, SYSTEM_USER } from "@/lib/activity/filters";
import { actionLabel, detailLines, entityHref, entityLabel } from "@/lib/activity/present";
import { PageHeader } from "@/components/admin/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";

export const metadata = { title: "Activity log" };

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await requirePagePermission(ADMIN_SECTIONS.activityLog.permission);
  const canManageUsers = can(viewer.role, "users.manage");
  const filters = parseActivityFilters(await searchParams);
  const where = activityWhere(filters);

  const [entries, total, users, actionRows] = await Promise.all([
    db.activityLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * ACTIVITY_PAGE_SIZE,
      take: ACTIVITY_PAGE_SIZE,
      include: { user: { select: { name: true } } },
    }),
    db.activityLog.count({ where }),
    db.user.findMany({ select: { id: true, name: true, isActive: true }, orderBy: { name: "asc" } }),
    db.activityLog.groupBy({ by: ["action"], orderBy: { action: "asc" } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));
  const filtered = Boolean(filters.user || filters.action || filters.from || filters.to);

  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (filters.user) params.set("user", filters.user);
    if (filters.action) params.set("action", filters.action);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return query ? `/admin/activity?${query}` : "/admin/activity";
  };

  return (
    <>
      <PageHeader
        title="Activity log"
        description="Who did what, newest first. Guest contact details are never shown here."
      />

      <form method="get" role="search" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto_auto] lg:items-end">
        <label className="block text-sm font-medium">
          User
          <Select name="user" defaultValue={filters.user} className="mt-1.5">
            <option value="">Everyone</option>
            <option value={SYSTEM_USER}>System / website visitors</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
                {user.isActive ? "" : " (inactive)"}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-sm font-medium">
          Action
          <Select name="action" defaultValue={filters.action} className="mt-1.5">
            <option value="">All actions</option>
            {actionRows.map(({ action }) => (
              <option key={action} value={action}>
                {actionLabel(action)}
              </option>
            ))}
          </Select>
        </label>
        <label className="block text-sm font-medium">
          From
          <Input type="date" name="from" defaultValue={filters.from} className="mt-1.5" />
        </label>
        <label className="block text-sm font-medium">
          To
          <Input type="date" name="to" defaultValue={filters.to} className="mt-1.5" />
        </label>
        <div className="flex gap-2">
          <button type="submit" className={buttonClasses({ variant: "secondary" })}>
            Filter
          </button>
          {filtered && (
            <Link href="/admin/activity" className={buttonClasses({ variant: "ghost" })}>
              Clear
            </Link>
          )}
        </div>
      </form>

      {entries.length === 0 ? (
        <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-8 text-center text-sm text-charcoal-light">
          {filtered ? "No activity matches these filters." : "Nothing has been logged yet."}
        </p>
      ) : (
        <div className="relative overflow-x-auto rounded-lg border border-forest/10 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-forest/10 text-xs tracking-wide text-charcoal-light uppercase">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">When</th>
                <th scope="col" className="px-4 py-2 font-medium">Who</th>
                <th scope="col" className="px-4 py-2 font-medium">What</th>
                <th scope="col" className="px-4 py-2 font-medium">Related to</th>
                <th scope="col" className="px-4 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/10 align-top">
              {entries.map((entry) => {
                const href = entityHref({
                  entityType: entry.entityType,
                  entityId: entry.entityId,
                  action: entry.action,
                  canManageUsers,
                });
                const label = entityLabel(entry.entityType, entry.details);
                const lines = detailLines(entry.details);
                return (
                  <tr key={entry.id}>
                    <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(entry.createdAt)}</td>
                    <td className="px-4 py-2">{entry.user?.name ?? <span className="text-charcoal-light">System</span>}</td>
                    <td className="px-4 py-2">{actionLabel(entry.action)}</td>
                    <td className="px-4 py-2">
                      {href ? (
                        <Link href={href} className="text-forest underline underline-offset-4">
                          {label}
                        </Link>
                      ) : (
                        label
                      )}
                    </td>
                    <td className="px-4 py-2 text-charcoal-light">
                      {lines.length === 0 ? (
                        "–"
                      ) : (
                        <ul className="space-y-0.5">
                          {lines.map((line) => (
                            <li key={`${line.label}:${line.value}`}>
                              <span className="text-charcoal">{line.label}:</span> {line.value}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-sm">
        {filters.page > 1 ? (
          <Link href={pageHref(filters.page - 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Newer
          </Link>
        ) : (
          <span />
        )}
        <span className="text-charcoal-light">
          {total} {total === 1 ? "entry" : "entries"} · Page {filters.page} of {pages}
        </span>
        {filters.page < pages ? (
          <Link href={pageHref(filters.page + 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Older
          </Link>
        ) : (
          <span />
        )}
      </div>
    </>
  );
}
