import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import type { GalleryCategory, HomepageSlotKey } from "@/generated/prisma/enums";
import type { MediaImageData } from "@/components/media/media-image";
import { CONTENT_TAG } from "./revalidate";
import { loadStayTerms } from "./stay-terms";
import { fillTokens, type TokenContext } from "./tokens";
import { hasPlaceholderIn, liveValue, mediaVisible, showPlaceholders } from "./placeholder";

/**
 * Every public page reads content through here: one cached read per kind, all
 * invalidated by CONTENT_TAG when an admin saves. Placeholder fields are applied
 * here too, so no component has to remember to hide them in production.
 */

const cached = <A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: string) =>
  unstable_cache(fn, ["site", key], { tags: [CONTENT_TAG], revalidate: 3600 });

const mediaSelect = {
  url: true,
  altText: true,
  width: true,
  height: true,
  blurDataUrl: true,
  isPlaceholder: true,
  placeholderNote: true,
} as const;

type MediaRow = { url: string; altText: string; width: number; height: number; blurDataUrl: string | null; isPlaceholder: boolean; placeholderNote: string | null };

/** Flagged images (stand-ins, rights unconfirmed) show with a badge in dev and are hidden everywhere in production. */
const isShown = (m: { isPlaceholder: boolean }) => mediaVisible(m);
const toPublicMedia = (m: MediaRow): PublicMedia => ({
  url: m.url,
  altText: m.altText,
  width: m.width,
  height: m.height,
  blurDataUrl: m.blurDataUrl,
  isPlaceholder: m.isPlaceholder,
  placeholderNote: m.placeholderNote,
});
const shownMedia = (rows: MediaRow[]): PublicMedia[] => rows.filter(isShown).map(toPublicMedia);

/** `isPlaceholder`: a stand-in or rights-unconfirmed image; only ever present in development. */
export type PublicMedia = MediaImageData & { isPlaceholder?: boolean; placeholderNote?: string | null };

// ─── Business ────────────────────────────────────────────────────────────────

export type Business = {
  name: string;
  tagline: string | null;
  intro: string | null;
  address: string | null;
  phones: string[];
  whatsapp: string | null;
  emails: string[];
  instagramUrl: string | null;
  facebookUrl: string | null;
  googleMapsUrl: string | null;
  directionsUrl: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  latitude: number | null;
  longitude: number | null;
};

const BUSINESS_FIELDS = [
  "tagline",
  "intro",
  "address",
  "whatsapp",
  "instagramUrl",
  "facebookUrl",
  "googleMapsUrl",
  "directionsUrl",
  "checkInTime",
  "checkOutTime",
  "latitude",
  "longitude",
] as const;

export const getBusiness = cached(async (): Promise<Business> => {
  const row = await db.businessInfo.findUnique({ where: { id: 1 } });
  if (!row) throw new Error("BusinessInfo row is missing. Run `npm run seed:content`.");
  const flagged = new Set(row.placeholderFields);
  const hide = (field: string) => flagged.has(field) && !showPlaceholders;
  const out = { name: row.name } as Business;
  for (const f of BUSINESS_FIELDS) (out as Record<string, unknown>)[f] = hide(f) ? null : row[f];
  out.phones = hide("phones") ? [] : row.phones;
  out.emails = hide("emails") ? [] : row.emails;
  return out;
}, "business");

export const getStayTerms = cached(loadStayTerms, "stay-terms");

// ─── Activities, events, dining, FAQs, policies, nearby ─────────────────────

export type ActivityGroupKey = "AT_BAGAICHA" | "CLOSE_BY" | "DAY_TRIP";

export type PublicActivity = {
  id: string;
  slug: string;
  title: string;
  group: ActivityGroupKey;
  category: string | null;
  summary: string | null;
  overview: string | null;
  duration: string | null;
  season: string | null;
  bestTime: string | null;
  bestFor: string[];
  /** "What you might see" */
  highlights: string[];
  whatToExpect: string | null;
  howWeHelp: string | null;
  tip: string | null;
  /** Distance and travel time come only from the linked nearby destination. */
  destination: { name: string; distance: string | null; travelTime: string | null; placeholder: boolean } | null;
  /** Primary photo first, then the extras in order (flagged images are already filtered out). */
  photos: PublicMedia[];
  /** The primary photo, for compact views. */
  cover: PublicMedia | null;
  placeholderFields: string[];
};

export const getActivities = cached(async (): Promise<PublicActivity[]> => {
  const rows = await db.activity.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: {
      coverMedia: { select: mediaSelect },
      photos: { orderBy: { sortOrder: "asc" }, include: { media: { select: mediaSelect } } },
      destination: true,
    },
  });
  return rows
    .filter((r) => !hasPlaceholderIn(r, ["title"]) || showPlaceholders)
    .map((r) => {
      const list = (field: "bestFor" | "highlights") => (r.placeholderFields.includes(field) && !showPlaceholders ? [] : r[field]);
      const photos = shownMedia([...(r.coverMedia ? [r.coverMedia] : []), ...r.photos.map((p) => p.media)]);
      const d = r.destination;
      return {
        id: r.id,
        slug: r.slug,
        title: r.title,
        group: r.group,
        category: liveValue<string>(r, "category"),
        summary: liveValue<string>(r, "summary"),
        overview: liveValue<string>(r, "overview"),
        duration: liveValue<string>(r, "duration"),
        season: liveValue<string>(r, "season"),
        bestTime: liveValue<string>(r, "bestTime"),
        bestFor: list("bestFor"),
        highlights: list("highlights"),
        whatToExpect: liveValue<string>(r, "whatToExpect"),
        howWeHelp: liveValue<string>(r, "howWeHelp"),
        tip: liveValue<string>(r, "tip"),
        destination: d
          ? {
              name: d.name,
              distance: liveValue<string>(d, "distance"),
              travelTime: liveValue<string>(d, "travelTime"),
              placeholder: showPlaceholders && (d.placeholderFields.includes("distance") || d.placeholderFields.includes("travelTime")),
            }
          : null,
        photos,
        cover: photos[0] ?? null,
        placeholderFields: showPlaceholders ? r.placeholderFields : [],
      };
    });
}, "activities");

export type PublicEventType = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string | null;
  highlights: string[];
  cover: PublicMedia | null;
  placeholderFields: string[];
};

export const getEventTypes = cached(async (): Promise<PublicEventType[]> => {
  const rows = await db.eventType.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { coverMedia: { select: mediaSelect } },
  });
  return rows
    .filter((r) => !hasPlaceholderIn(r, ["name"]) || showPlaceholders)
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      summary: liveValue<string>(r, "summary"),
      description: liveValue<string>(r, "description"),
      highlights: r.placeholderFields.includes("highlights") && !showPlaceholders ? [] : r.highlights,
      cover: r.coverMedia && isShown(r.coverMedia) ? toPublicMedia(r.coverMedia) : null,
      placeholderFields: showPlaceholders ? r.placeholderFields : [],
    }));
}, "event-types");

export type PublicDiningSection = {
  id: string;
  title: string;
  description: string | null;
  items: { id: string; name: string; description: string | null; priceNpr: number | null }[];
  placeholderFields: string[];
};

export const getDining = cached(async (): Promise<PublicDiningSection[]> => {
  const rows = await db.diningSection.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: { items: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  });
  return rows
    .filter((s) => !hasPlaceholderIn(s, ["title"]) || showPlaceholders)
    .map((s) => ({
      id: s.id,
      title: s.title,
      description: liveValue<string>(s, "description"),
      items: s.items
        .filter((i) => showPlaceholders || !hasPlaceholderIn(i, ["name"]))
        .map((i) => ({
          id: i.id,
          name: i.name,
          description: liveValue<string>(i, "description"),
          priceNpr: i.placeholderFields.includes("priceNpr") && !showPlaceholders ? null : i.priceNpr,
        })),
      placeholderFields: showPlaceholders ? s.placeholderFields : [],
    }));
}, "dining");

/** Facts that FAQ answers and policies may insert with {{tokens}} (see tokens.ts). */
async function loadTokenContext(): Promise<TokenContext> {
  const [business, terms, rooms, nearby] = await Promise.all([getBusiness(), getStayTerms(), getRoomTypes(), getNearby()]);
  return {
    checkInTime: terms.checkInTime,
    checkOutTime: terms.checkOutTime,
    address: business.address,
    cancellationPolicy: terms.cancellationPolicy,
    childUnderAge: terms.childUnderAge,
    rooms,
    nearby,
  };
}

export type PublicFaq = { id: string; question: string; answer: string; placeholderFields: string[] };

export const getFaqs = cached(async (): Promise<PublicFaq[]> => {
  const [rows, ctx] = await Promise.all([
    db.faq.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    loadTokenContext(),
  ]);
  return rows
    .filter((r) => showPlaceholders || !hasPlaceholderIn(r, ["question", "answer"]))
    .map((r) => ({ r, answer: fillTokens(r.answer, ctx) }))
    // A fact the answer relies on isn't saved yet: show it in dev (with the raw token), never in production.
    .filter(({ answer }) => answer.complete || showPlaceholders)
    .map(({ r, answer }) => ({
      id: r.id,
      question: r.question,
      answer: answer.text,
      placeholderFields: showPlaceholders ? r.placeholderFields : [],
    }));
}, "faqs");

export type PublicPolicy = { id: string; slug: string; title: string; body: string; placeholderFields: string[] };

export const getPolicies = cached(async (): Promise<PublicPolicy[]> => {
  const [rows, ctx] = await Promise.all([
    db.policy.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }] }),
    loadTokenContext(),
  ]);
  return rows
    .filter((r) => showPlaceholders || !hasPlaceholderIn(r, ["title", "body"]))
    .map((r) => ({ r, body: fillTokens(r.body, ctx) }))
    .filter(({ body }) => body.complete || showPlaceholders)
    .map(({ r, body }) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      body: body.text,
      placeholderFields: showPlaceholders ? r.placeholderFields : [],
    }));
}, "policies");

export type PublicNearby = { id: string; name: string; distance: string | null; travelTime: string | null; icon: string | null };

export const getNearby = cached(async (): Promise<PublicNearby[]> => {
  const rows = await db.nearbyDestination.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return rows
    // A destination without a confirmed distance isn't listed on the live site.
    .filter((r) => showPlaceholders || !hasPlaceholderIn(r, ["name", "distance"]))
    .map((r) => ({
      id: r.id,
      name: r.name,
      distance: liveValue<string>(r, "distance"),
      travelTime: liveValue<string>(r, "travelTime"),
      icon: r.icon,
    }));
}, "nearby");

// ─── Rooms ───────────────────────────────────────────────────────────────────

export type PublicRoomType = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  basePriceNpr: number;
  childPricePerNightNpr: number;
  maxGuests: number;
  amenities: string[];
  photos: PublicMedia[];
  placeholderFields: string[];
};

export const getRoomTypes = cached(async (): Promise<PublicRoomType[]> => {
  const rows = await db.roomType.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { media: { orderBy: { sortOrder: "asc" }, include: { media: { select: mediaSelect } } } },
  });
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: liveValue<string>(r, "description"),
    basePriceNpr: r.basePriceNpr,
    childPricePerNightNpr: r.childPricePerNightNpr,
    maxGuests: r.maxGuests,
    amenities: r.placeholderFields.includes("amenities") && !showPlaceholders ? [] : r.amenities,
    photos: shownMedia(r.media.map((m) => m.media)),
    placeholderFields: showPlaceholders ? r.placeholderFields : [],
  }));
}, "rooms");

// ─── Photos ──────────────────────────────────────────────────────────────────

export type HomepageSlots = Partial<Record<HomepageSlotKey, PublicMedia[]>>;

export const getHomepageSlots = cached(async (): Promise<HomepageSlots> => {
  const rows = await db.homepageSlot.findMany({
    orderBy: [{ slot: "asc" }, { sortOrder: "asc" }],
    include: { media: { select: mediaSelect } },
  });
  const out: HomepageSlots = {};
  for (const row of rows) {
    if (!isShown(row.media)) continue;
    (out[row.slot] ??= []).push(toPublicMedia(row.media));
  }
  return out;
}, "homepage-slots");

export type PublicGalleryItem = PublicMedia & { id: string; category: GalleryCategory };

export const getGallery = cached(async (): Promise<PublicGalleryItem[]> => {
  const rows = await db.galleryItem.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    include: { media: { select: mediaSelect } },
  });
  return rows.filter((r) => isShown(r.media)).map((r) => ({ ...toPublicMedia(r.media), id: r.id, category: r.category }));
}, "gallery");
