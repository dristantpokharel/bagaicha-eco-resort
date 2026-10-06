/**
 * One-off dev setup: place the seeded photos on the homepage, rooms and gallery.
 *
 *   npm run place:photos            # dry run: prints the proposed mapping, writes nothing
 *   npm run place:photos -- --apply # writes to the database in DATABASE_URL
 *
 * Idempotent: a photo already placed at a target is left alone. Single-image slots
 * (hero) that hold a different photo are REPLACED, and the dry run says so; the old
 * photo stays in the media library. Everything else is add-only. Never prints secrets.
 * The wedding mockup, QR code and map are never placed in the gallery.
 */
import { config as loadEnv } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import type { GalleryCategory, HomepageSlotKey } from "../src/generated/prisma/enums";

loadEnv({ path: ".env.local", quiet: true });

const apply = process.argv.includes("--apply");
const id = (name: string) => `bagaicha/seed/${name}`;

const HOMEPAGE: { slot: HomepageSlotKey; photos: string[]; single: boolean }[] = [
  // The main hero was placed once and is now managed in Media → Homepage, so it is not touched here.
  // Section photos (add-only). Order matters: the first photo leads its section.
  { slot: "ABOUT", photos: ["garden", "cottages", "hero-2"], single: false },
  { slot: "STAY", photos: ["room"], single: false },
  { slot: "DINE", photos: ["food", "restaurant"], single: false },
  { slot: "EXPLORE", photos: ["chill-pool"], single: false },
  // The wedding mockup is a dev stand-in (hidden in production); the lawn is the real fallback.
  { slot: "EVENTS", photos: ["wedding-mock", "lawn"], single: false },
  { slot: "CONFERENCE", photos: ["conference-room"], single: false },
  { slot: "LOCATION", photos: ["bagaicha-map"], single: false },
  // Explore page hero (single photos, replaced if a different one is placed).
  { slot: "EXPLORE_HERO_DESKTOP", photos: ["explore-jungle-walk"], single: true },
  { slot: "EXPLORE_HERO_MOBILE", photos: ["explore-hero-vertical"], single: true },
];

/** Primary photo (cover) and extras per activity. Village Walks has no photo yet. Images flagged in Media are hidden on the live site. */
const ACTIVITY_PHOTOS: Record<string, { cover: string; extras?: string[] }> = {
  "krishnasaar-blackbuck-visit": { cover: "explore-krishnasaar" },
  "tharu-village-visit": { cover: "explore-tharu-village" },
  "bardiya-jeep-safari": {
    cover: "explore-bardiya-elephants",
    extras: ["explore-jeep-safari", "explore-bardiya-tiger", "explore-bardiya-rhino", "explore-bardiya-np-gate"],
  },
  "bardiya-jungle-walk": { cover: "explore-jungle-walk" },
  "karnali-river": { cover: "explore-karnali" },
  birdwatching: { cover: "explore-birdwatching" },
  pickleball: { cover: "explore-pickleball" },
  "chill-pool": { cover: "chill-pool" },
};
const ROOM_TYPES: Record<string, string[]> = {
  "family-room": ["family-room-1", "family-room-2", "bed-close-up"],
  "deluxe-room": ["room", "curtains", "towel"],
};
const GALLERY: Record<GalleryCategory, string[]> = {
  PROPERTY: ["cottages", "garden", "lawn", "chill-pool"],
  ROOMS: ["room", "curtains", "towel", "bed-close-up", "family-room-1", "family-room-2"],
  DINING: ["food", "restaurant"],
  EVENTS: ["conference-room"],
  // Activity primary photos. The wedding mockup, QR code and map are never placed here.
  ACTIVITIES: [
    "explore-krishnasaar",
    "explore-tharu-village",
    "explore-bardiya-elephants",
    "explore-jungle-walk",
    "explore-karnali",
    "explore-birdwatching",
    "explore-pickleball",
    "chill-pool",
  ],
  // Bardiya landscapes and wildlife that are not the property. (The Malteser van is left out.)
  SURROUNDINGS: [
    "explore-bardiya-red-sunset-vertical",
    "explore-mustard-plan-vertical",
    "explore-bardiya-tiger",
    "explore-bardiya-rhino",
    "explore-bardiya-elephants",
    "explore-bardiya-crocodile",
  ],
};
const NEVER_IN_GALLERY = ["wedding-mock", "location-qr-code", "bagaicha-map", "explore-bardiya-caravan"];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
  console.log(apply ? "APPLY mode" : "DRY RUN (nothing is written; pass --apply to write)");
  try {
    const library = await db.media.findMany({ select: { id: true, cloudinaryPublicId: true, originalFilename: true } });
    const byPublicId = new Map(library.map((m) => [m.cloudinaryPublicId, m]));
    const label = new Map(library.map((m) => [m.id, m.cloudinaryPublicId.replace("bagaicha/seed/", "")]));
    const problems: string[] = [];
    const lookup = (name: string) => {
      const found = byPublicId.get(id(name));
      if (!found) problems.push(`not in the media library, skipped: ${name}`);
      return found;
    };
    let writes = 0;
    const ops: (() => Promise<unknown>)[] = [];

    console.log("\nHomepage slots");
    for (const { slot, photos, single } of HOMEPAGE) {
      const want = photos.map(lookup).filter((m) => !!m);
      const have = await db.homepageSlot.findMany({ where: { slot }, orderBy: { sortOrder: "asc" } });
      const haveIds = new Set(have.map((h) => h.mediaId));
      const toAdd = want.filter((m) => !haveIds.has(m.id));
      const toRemove = single ? have.filter((h) => !want.some((m) => m.id === h.mediaId)) : [];
      if (!toAdd.length && !toRemove.length) console.log(`  ${slot}: already placed (${want.map((m) => label.get(m.id)).join(", ")})`);
      for (const h of toRemove) {
        console.log(`  ${slot}: REPLACE ${label.get(h.mediaId) ?? h.mediaId} (stays in library)`);
        ops.push(() => db.homepageSlot.delete({ where: { id: h.id } }));
        writes++;
      }
      for (const m of toAdd) {
        console.log(`  ${slot}: add ${label.get(m.id)}`);
        const order = want.indexOf(m);
        ops.push(() => db.homepageSlot.create({ data: { slot, mediaId: m.id, sortOrder: order } }));
        writes++;
      }
    }

    console.log("\nRoom types");
    for (const [slug, photos] of Object.entries(ROOM_TYPES)) {
      const roomType = await db.roomType.findUnique({ where: { slug }, select: { id: true } });
      if (!roomType) {
        console.log(`  ${slug}: room type does not exist, skipped (run setup:deluxe-room first?)`);
        continue;
      }
      const have = new Set((await db.roomTypeMedia.findMany({ where: { roomTypeId: roomType.id } })).map((r) => r.mediaId));
      photos.forEach((name, order) => {
        const m = lookup(name);
        if (!m) return;
        if (have.has(m.id)) return console.log(`  ${slug}: ${name} already placed`);
        console.log(`  ${slug}: add ${name}`);
        ops.push(() => db.roomTypeMedia.create({ data: { roomTypeId: roomType.id, mediaId: m.id, sortOrder: order } }));
        writes++;
      });
    }

    console.log("\nActivities (primary photo, then extras)");
    for (const [slug, { cover, extras = [] }] of Object.entries(ACTIVITY_PHOTOS)) {
      const activity = await db.activity.findUnique({
        where: { slug },
        select: { id: true, coverMediaId: true, photos: { select: { mediaId: true, sortOrder: true } } },
      });
      if (!activity) {
        console.log(`  ${slug}: activity does not exist, skipped (run seed:content first?)`);
        continue;
      }
      const coverMedia = lookup(cover);
      if (coverMedia) {
        if (activity.coverMediaId === coverMedia.id) console.log(`  ${slug}: primary ${cover} already placed`);
        else if (activity.coverMediaId) console.log(`  ${slug}: has a different primary photo, left alone`);
        else {
          console.log(`  ${slug}: primary ${cover}`);
          ops.push(() => db.activity.update({ where: { id: activity.id }, data: { coverMediaId: coverMedia.id } }));
          writes++;
        }
      }
      const have = new Set(activity.photos.map((p) => p.mediaId));
      let order = activity.photos.length ? Math.max(...activity.photos.map((p) => p.sortOrder)) + 1 : 0;
      for (const name of extras) {
        const m = lookup(name);
        if (!m) continue;
        if (have.has(m.id)) {
          console.log(`  ${slug}: extra ${name} already placed`);
          continue;
        }
        const sortOrder = order++;
        console.log(`  ${slug}: extra ${name}`);
        ops.push(() => db.activityMedia.create({ data: { activityId: activity.id, mediaId: m.id, sortOrder } }));
        writes++;
      }
    }

    console.log("\nGallery");
    for (const [category, photos] of Object.entries(GALLERY) as [GalleryCategory, string[]][]) {
      const have = new Set((await db.galleryItem.findMany({ where: { category } })).map((g) => g.mediaId));
      photos.forEach((name, order) => {
        if (NEVER_IN_GALLERY.includes(name)) throw new Error(`${name} must never be in the gallery`);
        const m = lookup(name);
        if (!m) return;
        if (have.has(m.id)) return console.log(`  ${category}: ${name} already placed`);
        console.log(`  ${category}: add ${name}`);
        ops.push(() => db.galleryItem.create({ data: { category, mediaId: m.id, sortOrder: order } }));
        writes++;
      });
      if (!photos.length) console.log(`  ${category}: nothing proposed`);
    }

    if (problems.length) console.log(`\nWarnings:\n  ${[...new Set(problems)].join("\n  ")}`);
    console.log(`\n${writes} change(s) ${apply ? "being applied" : "proposed"}.`);
    if (apply) {
      for (const op of ops) await op();
      console.log("Done.");
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
