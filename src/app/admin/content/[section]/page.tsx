import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { COLLECTIONS, type CollectionKey } from "@/lib/content/collections";
import { ContentForm, type ContentRow, type Option } from "../content-form";
import { loadMediaOptions, toContentRow } from "../rows";

const SECTIONS: Record<string, { title: string; intro: string; collections: readonly CollectionKey[] }> = {
  activities: { title: "Activities", intro: "Each activity opens into expandable details on the Explore page.", collections: ["activities"] },
  dining: { title: "Dining", intro: "Dining sections, and the dishes inside them.", collections: ["diningSections", "diningItems"] },
  events: { title: "Event types", intro: "Weddings, celebrations, conferences and the like.", collections: ["eventTypes"] },
  faqs: { title: "FAQs", intro: "Questions guests ask most.", collections: ["faqs"] },
  policies: { title: "Policies", intro: "Cancellation, check-in and anything else guests should know.", collections: ["policies"] },
  nearby: { title: "Nearby destinations", intro: "Places near the resort, with distance and travel time as written.", collections: ["nearby"] },
};

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return { title: SECTIONS[section]?.title ?? "Content" };
}

async function loadRows(key: CollectionKey): Promise<{ raw: Record<string, unknown>; row: ContentRow }[]> {
  const order = { orderBy: [{ sortOrder: "asc" as const }] };
  const rows: Record<string, unknown>[] =
    key === "activities" ? await db.activity.findMany(order)
    : key === "diningSections" ? await db.diningSection.findMany(order)
    : key === "diningItems" ? await db.diningItem.findMany({ orderBy: [{ sectionId: "asc" }, { sortOrder: "asc" }] })
    : key === "eventTypes" ? await db.eventType.findMany(order)
    : key === "faqs" ? await db.faq.findMany(order)
    : key === "policies" ? await db.policy.findMany(order)
    : key === "nearby" ? await db.nearbyDestination.findMany(order)
    : [];
  return rows.map((raw) => ({ raw, row: toContentRow(key, raw) }));
}

export default async function ContentSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const config = SECTIONS[section];
  if (!config) notFound();
  const keys = config.collections;

  const needsMedia = keys.some((k) => COLLECTIONS[k].fields.some((f) => f.kind === "media"));
  const mediaOptions = needsMedia ? await loadMediaOptions() : [];
  const sections = keys.includes("diningItems")
    ? await db.diningSection.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, title: true } })
    : [];
  const sectionOptions: Option[] = sections.map((s) => ({ value: s.id, label: s.title }));

  return (
    <div className="max-w-3xl space-y-10">
      <p className="text-sm text-charcoal-light">{config.intro}</p>
      {await Promise.all(
        keys.map(async (key) => {
          const collection = COLLECTIONS[key];
          const rows = await loadRows(key);
          return (
            <section key={key} aria-labelledby={`h-${key}`}>
              {keys.length > 1 && (
                <h2 id={`h-${key}`} className="mb-3 font-display text-lg text-forest">
                  {collection.label}
                </h2>
              )}
              <ul className="space-y-2">
                {rows.map(({ raw, row }) => {
                  const title = String(raw[collection.titleField] ?? "");
                  return (
                    <li key={row.id} className="rounded-md border border-forest/15 bg-white">
                      <details>
                        <summary className="flex min-h-12 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 focus-visible:outline-2 focus-visible:outline-forest">
                          <span className="font-medium text-charcoal">{title}</span>
                          {row.placeholderFields.length > 0 && (
                            <span className="rounded-sm border border-warning/40 px-1.5 py-0.5 text-xs text-warning">
                              {row.placeholderFields.length} placeholder{row.placeholderFields.length === 1 ? "" : "s"}
                            </span>
                          )}
                          {!row.isActive && (
                            <span className="rounded-sm border border-charcoal/25 px-1.5 py-0.5 text-xs text-charcoal-light">Hidden</span>
                          )}
                        </summary>
                        <div className="border-t border-forest/10 p-4">
                          <ContentForm collection={key} row={row} mediaOptions={mediaOptions} sectionOptions={sectionOptions} />
                        </div>
                      </details>
                    </li>
                  );
                })}
                {rows.length === 0 && <li className="text-sm text-charcoal-light">Nothing here yet.</li>}
              </ul>
              <details className="mt-3 rounded-md border border-dashed border-forest/30 bg-white">
                <summary className="flex min-h-12 cursor-pointer items-center px-4 py-2 font-medium text-forest focus-visible:outline-2 focus-visible:outline-forest">
                  Add {collection.singular}
                </summary>
                <div className="border-t border-forest/10 p-4">
                  <ContentForm collection={key} mediaOptions={mediaOptions} sectionOptions={sectionOptions} />
                </div>
              </details>
            </section>
          );
        }),
      )}
    </div>
  );
}
