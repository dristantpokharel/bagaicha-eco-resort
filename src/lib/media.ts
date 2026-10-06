import type { Prisma } from "@/generated/prisma/client";

/** Fields every media view needs (matches MediaImageData plus admin details). */
export const mediaSelect = {
  id: true,
  url: true,
  altText: true,
  altNeedsReview: true,
  width: true,
  height: true,
  blurDataUrl: true,
  format: true,
  bytes: true,
  originalFilename: true,
  createdAt: true,
} satisfies Prisma.MediaSelect;

/** Where an image is used. An image with any usage can't be deleted. */
export const mediaUsageSelect = {
  roomTypes: { select: { roomType: { select: { id: true, name: true } } } },
  galleryItems: { select: { category: true } },
  homepageSlots: { select: { slot: true } },
  activities: { select: { id: true, title: true } },
  eventTypes: { select: { id: true, name: true } },
} satisfies Prisma.MediaSelect;

type UsageRow = Prisma.MediaGetPayload<{ select: typeof mediaUsageSelect }>;

export function describeUsage(media: UsageRow): string[] {
  return [
    ...media.roomTypes.map((r) => `Room: ${r.roomType.name}`),
    ...media.galleryItems.map((g) => `Gallery: ${GALLERY_LABELS[g.category]}`),
    ...media.homepageSlots.map((h) => `Homepage: ${HOMEPAGE_SLOT_LABELS[h.slot]}`),
    ...media.activities.map((a) => `Activity: ${a.title}`),
    ...media.eventTypes.map((e) => `Event: ${e.name}`),
  ];
}

export const GALLERY_LABELS = {
  ROOMS: "Rooms",
  DINING: "Dining",
  ACTIVITIES: "Activities",
  EVENTS: "Events",
  PROPERTY: "Property",
} as const;

export const HOMEPAGE_SLOT_LABELS = {
  HERO_DESKTOP: "Hero (desktop)",
  HERO_MOBILE: "Hero (phone)",
  ABOUT: "About",
  STAY: "Stay",
  DINE: "Dine",
  EXPLORE: "Explore",
  EVENTS: "Events",
  CONFERENCE: "Conference",
  LOCATION: "Location",
} as const;

export function formatBytes(bytes: number | null) {
  if (bytes == null) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
