-- AlterTable
ALTER TABLE "media" ADD COLUMN     "altNeedsReview" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bytes" INTEGER,
ADD COLUMN     "format" TEXT,
ADD COLUMN     "originalFilename" TEXT;

-- Existing media that already has alt text does not need review.
UPDATE "media" SET "altNeedsReview" = false WHERE "altText" <> '';
