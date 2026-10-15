import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { CONTENT_TAG } from "@/lib/content/revalidate";
import { liveValue, mediaVisible } from "@/lib/content/placeholder";
import type { PublicMedia } from "@/lib/content/queries";
import { faqSchema, type FaqEntry } from "./schemas";
import { isPubliclyVisible, readingMinutes } from "./visibility";

export type PublicGuide = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  tags: string[];
  authorName: string;
  authorRole: string | null;
  publishedAt: Date;
  updatedAt: Date;
  seoTitle: string | null;
  seoDescription: string | null;
  faq: FaqEntry[];
  cover: PublicMedia | null;
  readingMinutes: number;
};

type Stored = Omit<PublicGuide, "publishedAt" | "updatedAt" | "readingMinutes"> & {
  publishedAt: string;
  updatedAt: string;
  placeholderFields: string[];
};

/**
 * Every published guide, cached under the content tag (dates are stored as strings because the
 * cache serialises to JSON). The "is it live yet" check runs per request in `visibleGuides`, so a
 * scheduled guide appears on its date without waiting for the cache.
 */
const loadPublished = unstable_cache(
  async (): Promise<Stored[]> => {
    const rows = await db.guide.findMany({
      where: { status: "PUBLISHED", publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
      include: { cover: true },
    });
    return rows.map((g) => ({
      id: g.id,
      slug: g.slug,
      title: g.title,
      excerpt: g.excerpt,
      body: g.body,
      tags: g.tags,
      authorName: g.authorName,
      authorRole: g.authorRole,
      publishedAt: g.publishedAt!.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
      seoTitle: liveValue<string>(g, "seoTitle"),
      seoDescription: liveValue<string>(g, "seoDescription"),
      faq: faqSchema.catch([]).parse(g.faq),
      placeholderFields: g.placeholderFields,
      cover:
        g.cover && mediaVisible(g.cover)
          ? {
              url: g.cover.url,
              altText: g.cover.altText,
              width: g.cover.width,
              height: g.cover.height,
              blurDataUrl: g.cover.blurDataUrl,
              isPlaceholder: g.cover.isPlaceholder,
              placeholderNote: g.cover.placeholderNote,
            }
          : null,
    }));
  },
  ["guides", "published"],
  { tags: [CONTENT_TAG], revalidate: 3600 },
);

/** Newest first. Only guides the public may see (see `isPubliclyVisible`). */
export async function visibleGuides(now: Date = new Date()): Promise<PublicGuide[]> {
  const rows = await loadPublished();
  return rows
    .filter((g) => isPubliclyVisible({ status: "PUBLISHED", publishedAt: new Date(g.publishedAt), placeholderFields: g.placeholderFields }, now))
    .map((g) => ({
      id: g.id,
      slug: g.slug,
      title: g.title,
      excerpt: g.excerpt,
      body: g.body,
      tags: g.tags,
      authorName: g.authorName,
      authorRole: g.authorRole,
      seoTitle: g.seoTitle,
      seoDescription: g.seoDescription,
      faq: g.faq,
      cover: g.cover,
      publishedAt: new Date(g.publishedAt),
      updatedAt: new Date(g.updatedAt),
      readingMinutes: readingMinutes(g.body),
    }));
}

export async function getVisibleGuide(slug: string): Promise<PublicGuide | null> {
  return (await visibleGuides()).find((g) => g.slug === slug) ?? null;
}

/** All tags in use, most used first. */
export function tagsOf(guides: PublicGuide[]): string[] {
  const counts = new Map<string, number>();
  for (const g of guides) for (const t of g.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

/** Up to `limit` other guides, those sharing the most tags first, then newest. */
export function relatedGuides(all: PublicGuide[], current: PublicGuide, limit = 3): PublicGuide[] {
  const mine = new Set(current.tags);
  return all
    .filter((g) => g.id !== current.id)
    .map((g) => ({ g, shared: g.tags.filter((t) => mine.has(t)).length }))
    .sort((a, b) => b.shared - a.shared || b.g.publishedAt.getTime() - a.g.publishedAt.getTime())
    .slice(0, limit)
    .map((x) => x.g);
}
