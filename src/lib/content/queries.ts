import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import type { GalleryCategory, HomepageSlotKey } from "@/generated/prisma/enums";
import type { MediaImageData } from "@/components/media/media-image";
import { CONTENT_TAG } from "./revalidate";
import { hasPlaceholderIn, isMockupPhoto, liveValue, showPlaceholders } from "./placeholder";

/**
 * Every public page reads content through here: one cached read per kind, all
 * invalidated by CONTENT_TAG when an admin saves. Placeholder fields are applied
 * here too, so no component has to remember to hide them in production.
 */

const cached = <A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: string) =>
  unstable_cache(fn, ["site", key], { tags: [CONTENT_TAG], revalidate: 3600 });

const mediaSelect = { url: true, altText: true, width: true, height: true, blurDataUrl: true } as const;

/** `isPlaceholder`: a mockup standing in for real photography (dev only). */
export type PublicMedia = MediaImageData & { isPlaceholder?: boolean };

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

// ─── Activities, events, dining, FAQs, policies, nearby ─────────────────────

export type PublicActivity = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  overview: string | null;
  duration: string | null;
  bestTime: string | null;
  whatToExpect: string | null;
  cover: PublicMedia | null;
  placeholderFields: string[];
};

export const getActivities = cached(async (): Promise<PublicActivity[]> => {
  const rows = await db.activity.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: { coverMedia: { select: mediaSelect } },
  });
  return rows
    .filter((r) => !hasPlaceholderIn(r, ["title"]) || showPlaceholders)
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      summary: liveValue<string>(r, "summary"),
      overview: liveValue<string>(r, "overview"),
      duration: liveValue<string>(r, "duration"),
      bestTime: liveValue<string>(r, "bestTime"),
      whatToExpect: liveValue<string>(r, "whatToExpect"),
      cover: r.coverMedia,
      placeholderFields: showPlaceholders ? r.placeholderFields : [],
    }));
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
      cover: r.coverMedia,
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

export type PublicFaq = { id: string; question: string; answer: string; placeholderFields: string[] };

export const getFaqs = cached(async (): Promise<PublicFaq[]> => {
  const rows = await db.faq.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return rows
    .filter((r) => showPlaceholders || !hasPlaceholderIn(r, ["question", "answer"]))
    .map((r) => ({ id: r.id, question: r.question, answer: r.answer, placeholderFields: showPlaceholders ? r.placeholderFields : [] }));
}, "faqs");

export type PublicPolicy = { id: string; slug: string; title: string; body: string; placeholderFields: string[] };

export const getPolicies = cached(async (): Promise<PublicPolicy[]> => {
  const rows = await db.policy.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }] });
  return rows
    .filter((r) => showPlaceholders || !hasPlaceholderIn(r, ["title", "body"]))
    .map((r) => ({ id: r.id, slug: r.slug, title: r.title, body: r.body, placeholderFields: showPlaceholders ? r.placeholderFields : [] }));
}, "policies");

export type PublicNearby = { id: string; name: string; distance: string | null; travelTime: string | null; icon: string | null };

export const getNearby = cached(async (): Promise<PublicNearby[]> => {
  const rows = await db.nearbyDestination.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return rows
    .filter((r) => showPlaceholders || !hasPlaceholderIn(r, ["name"]))
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
    photos: r.media.map((m) => m.media),
    placeholderFields: showPlaceholders ? r.placeholderFields : [],
  }));
}, "rooms");

// ─── Photos ──────────────────────────────────────────────────────────────────

export type HomepageSlots = Partial<Record<HomepageSlotKey, PublicMedia[]>>;

export const getHomepageSlots = cached(async (): Promise<HomepageSlots> => {
  const rows = await db.homepageSlot.findMany({
    orderBy: [{ slot: "asc" }, { sortOrder: "asc" }],
    include: { media: { select: { ...mediaSelect, originalFilename: true } } },
  });
  const out: HomepageSlots = {};
  for (const row of rows) {
    // Mockups are stand-ins for real photography: dev only, with a badge.
    const mockup = isMockupPhoto(row.media.originalFilename);
    if (mockup && !showPlaceholders) continue;
    const { url, altText, width, height, blurDataUrl } = row.media;
    (out[row.slot] ??= []).push({ url, altText, width, height, blurDataUrl, isPlaceholder: mockup });
  }
  return out;
}, "homepage-slots");

export type PublicGalleryItem = PublicMedia & { id: string; category: GalleryCategory };

export const getGallery = cached(async (): Promise<PublicGalleryItem[]> => {
  const rows = await db.galleryItem.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    include: { media: { select: mediaSelect } },
  });
  return rows.map((r) => ({ ...r.media, id: r.id, category: r.category }));
}, "gallery");
