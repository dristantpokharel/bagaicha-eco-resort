/**
 * One-off dev setup: create the Deluxe Room type, its four rooms and its photos.
 *
 *   npm run setup:deluxe-room            # dry run: prints what would change, writes nothing
 *   npm run setup:deluxe-room -- --apply # writes to the database in DATABASE_URL
 *
 * Idempotent and never updates or deletes: if a room type with slug "deluxe-room"
 * already exists it is reported and nothing is changed. Description and amenities
 * are flagged placeholders (docs: AGENTS.md rule 5). Never prints secret values.
 */
import { config as loadEnv } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import { logActivity } from "../src/lib/activity-log";

loadEnv({ path: ".env.local", quiet: true });

const apply = process.argv.includes("--apply");

const ROOM_TYPE = {
  slug: "deluxe-room",
  name: "Deluxe Room",
  basePriceNpr: 3000,
  childPricePerNightNpr: 500,
  maxGuests: 3,
  maxAdults: 2,
  isActive: true,
  description: "Placeholder: room description, owner to provide.",
  amenities: ["Placeholder: amenities, owner to provide"],
  placeholderFields: ["description", "amenities"],
} as const;
const ROOM_NAMES = ["201", "202", "203", "204"];
/** Seeded photos (public ID bagaicha/seed/<slug>), in display order. */
const PHOTOS = ["room", "curtains", "towel"];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
  console.log(apply ? "APPLY mode" : "DRY RUN (nothing is written; pass --apply to write)");
  try {
    const existing = await db.roomType.findUnique({ where: { slug: ROOM_TYPE.slug }, select: { id: true, name: true } });
    if (existing) {
      console.log(`A room type with slug "${ROOM_TYPE.slug}" already exists ("${existing.name}"). No changes made.`);
      return;
    }

    const media = await db.media.findMany({
      where: { cloudinaryPublicId: { in: PHOTOS.map((p) => `bagaicha/seed/${p}`) } },
      select: { id: true, cloudinaryPublicId: true },
    });
    const byId = new Map(media.map((m) => [m.cloudinaryPublicId, m.id]));
    const missing = PHOTOS.filter((p) => !byId.has(`bagaicha/seed/${p}`));
    if (missing.length) throw new Error(`Photos not in the media library: ${missing.join(", ")}. Nothing written.`);

    console.log(`Would create room type "${ROOM_TYPE.name}": ${ROOM_TYPE.basePriceNpr} NPR/night, max ${ROOM_TYPE.maxGuests} guests, child ${ROOM_TYPE.childPricePerNightNpr} NPR/night, active`);
    console.log(`  placeholder (flagged): ${ROOM_TYPE.placeholderFields.join(", ")}`);
    console.log(`  rooms: ${ROOM_NAMES.join(", ")}`);
    console.log(`  photos: ${PHOTOS.join(", ")}`);
    if (!apply) return;

    await db.$transaction(async (tx) => {
      const sortOrder = ((await tx.roomType.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0) + 1;
      const roomType = await tx.roomType.create({
        data: { ...ROOM_TYPE, amenities: [...ROOM_TYPE.amenities], placeholderFields: [...ROOM_TYPE.placeholderFields], sortOrder },
      });
      for (const name of ROOM_NAMES) {
        const room = await tx.room.create({ data: { roomTypeId: roomType.id, name } });
        await tx.stockLocation.upsert({ where: { roomId: room.id }, update: {}, create: { kind: "ROOM", roomId: room.id } });
      }
      await tx.roomTypeMedia.createMany({
        data: PHOTOS.map((p, i) => ({ roomTypeId: roomType.id, mediaId: byId.get(`bagaicha/seed/${p}`)!, sortOrder: i })),
      });
      await logActivity(tx, {
        userId: null,
        action: "roomType.created",
        entityType: "RoomType",
        entityId: roomType.id,
        details: { name: roomType.name, via: "setup:deluxe-room script" },
      });
    });
    console.log("Created.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
