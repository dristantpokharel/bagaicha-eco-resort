import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { CONTENT_TAG } from "@/lib/content/revalidate";
import { hasPlaceholderIn, liveValue, showPlaceholders } from "@/lib/content/placeholder";
import { getNearby, isShown, mediaSelect, shownMedia, toPublicMedia, type PublicMedia, type PublicNearby } from "@/lib/content/queries";
import { visibleGuides } from "@/lib/guides/queries";
import { isKrishnasaarLive, sectionText } from "./visibility";

export type KrishnasaarFaq = { id: string; question: string; answer: string; flagged: boolean };

export type PublicKrishnasaar = {
  title: string;
  intro: string | null;
  whatItIs: string | null;
  history: string | null;
  wildlife: string | null;
  bestTime: string | null;
  gettingThere: string | null;
  whatToBring: string | null;
  cover: PublicMedia | null;
  gallery: PublicMedia[];
  /** Distance and travel time come only from the linked nearby destination. */
  destination: { name: string; distance: string | null; travelTime: string | null } | null;
  nearby: PublicNearby[];
  faqs: KrishnasaarFaq[];
  guides: { slug: string; title: string; excerpt: string }[];
  /** Fields still flagged "verify" (dev and staging only; empty in production). */
  flagged: string[];
};

/**
 * The Krishnasaar page for the public site, or null when it must not exist yet (no row, or
 * title / intro / "what it is" still flagged in production). Every caller (page, homepage band,
 * Explore, footer, sitemap, llms.txt, JSON-LD) goes through here, so they never disagree.
 */
const loadPage = unstable_cache(
  async (): Promise<Omit<PublicKrishnasaar, "guides" | "nearby"> & { guideSlugs: string[] } | null> => {
    const page = await db.krishnasaarPage.findUnique({
      where: { id: 1 },
      include: { coverMedia: { select: mediaSelect }, destination: true },
    });
    if (!isKrishnasaarLive(page, showPlaceholders) || !page) return null;
    const [gallery, faqRows] = await Promise.all([
      db.krishnasaarMedia.findMany({ orderBy: { sortOrder: "asc" }, include: { media: { select: mediaSelect } } }),
      db.krishnasaarFaq.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    ]);
    const d = page.destination;
    const text = (field: string) => sectionText(page, field, showPlaceholders);
    return {
      title: page.title,
      intro: text("intro"),
      whatItIs: text("whatItIs"),
      history: text("history"),
      wildlife: text("wildlife"),
      bestTime: text("bestTime"),
      gettingThere: text("gettingThere"),
      whatToBring: text("whatToBring"),
      cover: page.coverMedia && isShown(page.coverMedia) ? toPublicMedia(page.coverMedia) : null,
      gallery: shownMedia(gallery.map((g) => g.media)),
      destination: d && (showPlaceholders || !hasPlaceholderIn(d, ["name"]))
        ? { name: d.name, distance: liveValue<string>(d, "distance"), travelTime: liveValue<string>(d, "travelTime") }
        : null,
      faqs: faqRows
        .filter((f) => showPlaceholders || !hasPlaceholderIn(f, ["question", "answer"]))
        .map((f) => ({ id: f.id, question: f.question, answer: f.answer, flagged: showPlaceholders && f.placeholderFields.length > 0 })),
      guideSlugs: page.relatedGuides,
      flagged: showPlaceholders ? page.placeholderFields : [],
    };
  },
  ["site", "krishnasaar"],
  { tags: [CONTENT_TAG], revalidate: 3600 },
);

export async function getKrishnasaar(): Promise<PublicKrishnasaar | null> {
  const page = await loadPage();
  if (!page) return null;
  const [nearby, guides] = await Promise.all([getNearby(), visibleGuides()]);
  const { guideSlugs, ...rest } = page;
  return {
    ...rest,
    nearby: nearby.filter((n) => n.name !== page.destination?.name),
    guides: guideSlugs
      .map((slug) => guides.find((g) => g.slug === slug))
      .filter((g): g is NonNullable<typeof g> => !!g)
      .map((g) => ({ slug: g.slug, title: g.title, excerpt: g.excerpt })),
  };
}

/** Whether the page exists for the public (for links, sitemap and llms.txt). */
export async function isKrishnasaarPublic(): Promise<boolean> {
  return (await loadPage()) !== null;
}
