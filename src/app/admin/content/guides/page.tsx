import Link from "next/link";
import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { buttonClasses } from "@/components/ui/button";
import { formatInTimeZone } from "date-fns-tz";
import { RESORT_TIMEZONE } from "@/lib/dates";
import { isPubliclyVisible } from "@/lib/guides/visibility";

export const metadata = { title: "Guides" };

export default async function GuidesAdminPage() {
  await requirePagePermission("content.manage");
  const guides = await db.guide.findMany({ orderBy: [{ status: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }] });
  const now = new Date();
  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-charcoal-light">Blog posts shown at /guides. Drafts never appear on the website.</p>
        <Link href="/admin/content/guides/new" className={buttonClasses()}>New guide</Link>
      </div>
      <ul className="space-y-2">
        {guides.map((g) => {
          const live = isPubliclyVisible(g, now);
          const state = g.status === "DRAFT" ? "Draft" : live ? "Published" : g.publishedAt && g.publishedAt > now ? "Scheduled" : "Published, hidden";
          return (
            <li key={g.id}>
              <Link href={`/admin/content/guides/${g.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-forest/15 bg-white px-4 py-3 hover:bg-cream focus-visible:outline-2 focus-visible:outline-forest">
                <span className="font-medium text-charcoal">{g.title}</span>
                <span className={`rounded-sm border px-1.5 py-0.5 text-xs ${live ? "border-success/40 text-success" : "border-charcoal/25 text-charcoal-light"}`}>{state}</span>
                {g.placeholderFields.length > 0 && (
                  <span className="rounded-sm border border-warning/40 px-1.5 py-0.5 text-xs text-warning">{g.placeholderFields.length} placeholder{g.placeholderFields.length === 1 ? "" : "s"}</span>
                )}
                {g.publishedAt && <span className="text-xs text-charcoal-light">{formatInTimeZone(g.publishedAt, RESORT_TIMEZONE, "d MMM yyyy")}</span>}
              </Link>
            </li>
          );
        })}
        {guides.length === 0 && <li className="text-sm text-charcoal-light">No guides yet.</li>}
      </ul>
    </div>
  );
}
