import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { describeUsage, mediaSelect, mediaUsageSelect } from "@/lib/media";
import { MediaUploader } from "./media-uploader";
import { MediaCard, type LibraryItem } from "./media-card";

export const metadata = { title: "Media" };

const FILTERS = {
  all: "All",
  review: "Alt text needs review",
  unused: "Not used",
} as const;
type Filter = keyof typeof FILTERS;

export default async function MediaLibraryPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requirePagePermission(ADMIN_SECTIONS.media.permission);
  const { show } = await searchParams;
  const filter: Filter = show === "review" || show === "unused" ? show : "all";

  const rows = await db.media.findMany({
    where: filter === "review" ? { altNeedsReview: true } : undefined,
    select: { ...mediaSelect, ...mediaUsageSelect },
    orderBy: { createdAt: "desc" },
  });
  const items: LibraryItem[] = rows
    .map(({ roomTypes, galleryItems, homepageSlots, activities, eventTypes, ...media }) => ({
      ...media,
      usage: describeUsage({ roomTypes, galleryItems, homepageSlots, activities, eventTypes }),
    }))
    .filter((item) => filter !== "unused" || item.usage.length === 0);

  return (
    <>
      <MediaUploader />

      <section aria-labelledby="library-heading">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="library-heading" className="font-display text-lg text-forest">
            Library <span className="text-sm text-charcoal-light">({items.length})</span>
          </h2>
          <ul className="flex flex-wrap gap-1 text-sm" aria-label="Filter images">
            {(Object.keys(FILTERS) as Filter[]).map((key) => (
              <li key={key}>
                <Link
                  href={key === "all" ? "/admin/media" : `/admin/media?show=${key}`}
                  aria-current={filter === key ? "page" : undefined}
                  className={`block rounded-md px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-forest ${
                    filter === key ? "bg-forest text-cream" : "text-charcoal hover:bg-forest/5"
                  }`}
                >
                  {FILTERS[key]}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {items.length === 0 ? (
          <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-8 text-center text-sm text-charcoal-light">
            {filter === "all" ? "No images yet. Upload some above." : "No images match this filter."}
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
              <MediaCard key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
