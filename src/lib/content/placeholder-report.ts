import "server-only";
import { db } from "@/lib/db";

export type PlaceholderEntry = { section: string; title: string; fields: string[]; href: string };

const flagged = { NOT: { placeholderFields: { isEmpty: true } } } as const;

/** Everything on the site that still holds placeholder text. Launch blockers (Phase 6). */
export async function listPlaceholders(): Promise<PlaceholderEntry[]> {
  const [business, activities, dining, items, events, faqs, policies, nearby, rooms, flaggedPhotos] = await Promise.all([
    db.businessInfo.findMany({ where: flagged }),
    db.activity.findMany({ where: flagged, orderBy: { sortOrder: "asc" } }),
    db.diningSection.findMany({ where: flagged, orderBy: { sortOrder: "asc" } }),
    db.diningItem.findMany({ where: flagged, orderBy: { sortOrder: "asc" } }),
    db.eventType.findMany({ where: flagged, orderBy: { sortOrder: "asc" } }),
    db.faq.findMany({ where: flagged, orderBy: { sortOrder: "asc" } }),
    db.policy.findMany({ where: flagged, orderBy: { sortOrder: "asc" } }),
    db.nearbyDestination.findMany({ where: flagged, orderBy: { sortOrder: "asc" } }),
    db.roomType.findMany({ where: flagged, orderBy: { sortOrder: "asc" } }),
    db.media.findMany({ where: { isPlaceholder: true }, select: { originalFilename: true, placeholderNote: true }, orderBy: { originalFilename: "asc" } }),
  ]);
  const out: PlaceholderEntry[] = [];
  const add = (section: string, href: string, rows: { title: string; placeholderFields: string[] }[]) => {
    for (const r of rows) out.push({ section, title: r.title, fields: r.placeholderFields, href });
  };
  add("Business info", "/admin/content", business.map((r) => ({ title: r.name, placeholderFields: r.placeholderFields })));
  for (const r of rooms) out.push({ section: "Rooms", title: r.name, fields: r.placeholderFields, href: `/admin/rooms/${r.id}` });
  add("Activities", "/admin/content/activities", activities.map((r) => ({ title: r.title, placeholderFields: r.placeholderFields })));
  add("Dining", "/admin/content/dining", dining.map((r) => ({ title: r.title, placeholderFields: r.placeholderFields })));
  add("Dining", "/admin/content/dining", items.map((r) => ({ title: r.name, placeholderFields: r.placeholderFields })));
  add("Event types", "/admin/content/events", events.map((r) => ({ title: r.name, placeholderFields: r.placeholderFields })));
  add("FAQs", "/admin/content/faqs", faqs.map((r) => ({ title: r.question, placeholderFields: r.placeholderFields })));
  add("Policies", "/admin/content/policies", policies.map((r) => ({ title: r.title, placeholderFields: r.placeholderFields })));
  add("Nearby", "/admin/content/nearby", nearby.map((r) => ({ title: r.name, placeholderFields: r.placeholderFields })));
  for (const photo of flaggedPhotos)
    out.push({
      section: "Photos",
      title: photo.originalFilename ?? "Untitled image",
      fields: [photo.placeholderNote ?? "placeholder / rights unconfirmed"],
      href: "/admin/media?show=placeholder",
    });
  return out;
}
