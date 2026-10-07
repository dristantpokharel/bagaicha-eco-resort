-- Per-room-type occupancy: maxAdults (required, backfilled from maxGuests) and maxChildren (optional, null = no limit).
-- AlterTable
ALTER TABLE "room_types" ADD COLUMN     "maxAdults" INTEGER,
ADD COLUMN     "maxChildren" INTEGER;

-- Backfill: every existing type took adults up to its total capacity.
UPDATE "room_types" SET "maxAdults" = "maxGuests";

ALTER TABLE "room_types" ALTER COLUMN "maxAdults" SET NOT NULL;
