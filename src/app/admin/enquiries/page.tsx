import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { formatDateTime } from "@/lib/dates";
import { ENQUIRY_STATUS_LABELS, ENQUIRY_TYPE_LABELS } from "@/lib/booking/labels";
import { ContactPhone } from "@/components/admin/contact-phone";
import { PageHeader } from "@/components/admin/page-header";
import { buttonClasses } from "@/components/ui/button";
import type { EnquiryStatus } from "@/generated/prisma/enums";
import { EnquiryStatusForm } from "./status-select";

export const metadata = { title: "Enquiries" };

const PAGE_SIZE = 25;
const STATUSES = Object.keys(ENQUIRY_STATUS_LABELS) as EnquiryStatus[];

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePagePermission(ADMIN_SECTIONS.enquiries.permission);
  const sp = await searchParams;
  const statusParam = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const status = STATUSES.find((s) => s === statusParam);
  const pageParam = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const where = status ? { status } : {};

  const [enquiries, total, counts] = await Promise.all([
    db.enquiry.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.enquiry.count({ where }),
    db.enquiry.groupBy({ by: ["status"], _count: true }),
  ]);
  const countOf = (s: EnquiryStatus) => counts.find((c) => c.status === s)?._count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `/admin/enquiries?${qs}` : "/admin/enquiries";
  };

  return (
    <>
      <PageHeader title="Enquiries" description="Messages from the enquiry form: events, conferences, larger groups and more." />
      <FilterTabs status={status} counts={{ NEW: countOf("NEW"), IN_PROGRESS: countOf("IN_PROGRESS"), CLOSED: countOf("CLOSED") }} />

      {enquiries.length === 0 ? (
        <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-8 text-center text-sm text-charcoal-light">
          {status ? `No ${ENQUIRY_STATUS_LABELS[status].toLowerCase()} enquiries.` : "No enquiries yet."}
        </p>
      ) : (
        <ul className="space-y-4">
          {enquiries.map((e) => (
            <li key={e.id} className="rounded-lg border border-forest/10 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium text-charcoal">{e.name}</h2>
                  <p className="text-xs text-charcoal-light">
                    {ENQUIRY_TYPE_LABELS[e.type]} · {formatDateTime(e.createdAt)}
                  </p>
                </div>
                <EnquiryStatusForm key={e.updatedAt.toISOString()} enquiryId={e.id} status={e.status} />
              </div>
              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {e.email && (
                  <div>
                    <dt className="sr-only">Email</dt>
                    <dd>
                      <a href={`mailto:${e.email}`} className="break-all underline-offset-2 hover:underline">
                        {e.email}
                      </a>
                    </dd>
                  </div>
                )}
                {e.phone && (
                  <div>
                    <dt className="sr-only">Phone</dt>
                    <dd>
                      <ContactPhone phone={e.phone} />
                    </dd>
                  </div>
                )}
              </dl>
              <p className="mt-3 text-sm whitespace-pre-wrap text-charcoal">{e.message}</p>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-charcoal-light">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}

/** Status tabs are links with a ?status= query, so SubNav's exact-path matching doesn't apply. */
function FilterTabs({ status, counts }: { status: EnquiryStatus | undefined; counts: Record<EnquiryStatus, number> }) {
  const tabs: { href: string; label: string; active: boolean }[] = [
    { href: "/admin/enquiries", label: "All", active: !status },
    ...STATUSES.map((s) => ({
      href: `/admin/enquiries?status=${s}`,
      label: `${ENQUIRY_STATUS_LABELS[s]} (${counts[s]})`,
      active: status === s,
    })),
  ];
  return (
    <nav aria-label="Enquiry status" className="mb-6 border-b border-forest/10">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <li key={tab.href} className="shrink-0">
            <Link
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={`block border-b-2 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-forest ${
                tab.active ? "border-forest font-medium text-forest" : "border-transparent text-charcoal-light hover:border-forest/30 hover:text-forest"
              }`}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
