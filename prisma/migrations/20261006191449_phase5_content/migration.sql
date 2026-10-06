-- Activities: `description` becomes `overview` (data is copied before the old column is dropped).
ALTER TABLE "activities"
ADD COLUMN     "bestTime" TEXT,
ADD COLUMN     "duration" TEXT,
ADD COLUMN     "overview" TEXT,
ADD COLUMN     "placeholderFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "whatToExpect" TEXT;
UPDATE "activities" SET "overview" = "description";
ALTER TABLE "activities" DROP COLUMN "description";

-- Business info: single phone/email become lists (main first); values are copied first.
ALTER TABLE "business_info"
ADD COLUMN     "directionsUrl" TEXT,
ADD COLUMN     "emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "intro" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "phones" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "placeholderFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "whatsapp" TEXT;
UPDATE "business_info" SET "phones" = ARRAY["phone"] WHERE "phone" IS NOT NULL AND "phone" <> '';
UPDATE "business_info" SET "emails" = ARRAY["email"] WHERE "email" IS NOT NULL AND "email" <> '';
ALTER TABLE "business_info" DROP COLUMN "email", DROP COLUMN "phone";

-- AlterTable
ALTER TABLE "dining_items" ADD COLUMN     "placeholderFields" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "dining_sections" ADD COLUMN     "placeholderFields" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "event_types" ADD COLUMN     "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "placeholderFields" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "faqs" ADD COLUMN     "placeholderFields" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "policies" ADD COLUMN     "placeholderFields" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "room_types" ADD COLUMN     "placeholderFields" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "nearby_destinations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "distance" TEXT,
    "travelTime" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "placeholderFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nearby_destinations_pkey" PRIMARY KEY ("id")
);
