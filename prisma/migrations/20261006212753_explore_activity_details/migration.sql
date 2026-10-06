-- CreateEnum
CREATE TYPE "ActivityGroup" AS ENUM ('AT_BAGAICHA', 'CLOSE_BY', 'DAY_TRIP');

-- AlterEnum
ALTER TYPE "GalleryCategory" ADD VALUE 'SURROUNDINGS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "HomepageSlotKey" ADD VALUE 'EXPLORE_HERO_DESKTOP';
ALTER TYPE "HomepageSlotKey" ADD VALUE 'EXPLORE_HERO_MOBILE';

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "bestFor" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "category" TEXT,
ADD COLUMN     "destinationId" TEXT,
ADD COLUMN     "group" "ActivityGroup" NOT NULL DEFAULT 'AT_BAGAICHA',
ADD COLUMN     "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "howWeHelp" TEXT,
ADD COLUMN     "season" TEXT,
ADD COLUMN     "tip" TEXT;

-- AlterTable
ALTER TABLE "media" ADD COLUMN     "isPlaceholder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "placeholderNote" TEXT;

-- CreateTable
CREATE TABLE "activity_media" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "activity_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_media_activityId_sortOrder_idx" ON "activity_media"("activityId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "activity_media_activityId_mediaId_key" ON "activity_media"("activityId", "mediaId");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "nearby_destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_media" ADD CONSTRAINT "activity_media_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_media" ADD CONSTRAINT "activity_media_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The wedding mockup was recognised by its filename; it becomes an ordinary flagged image.
UPDATE "media"
SET "isPlaceholder" = true,
    "placeholderNote" = 'Mockup image, not a real Bagaicha photo'
WHERE "originalFilename" ILIKE '%mock%';
