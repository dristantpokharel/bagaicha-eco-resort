-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "childPricePerNightNpr" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "enquiries" ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "room_types" ADD COLUMN     "childPricePerNightNpr" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "rate_limits" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key","windowStart")
);

-- CreateIndex
CREATE INDEX "rate_limits_windowStart_idx" ON "rate_limits"("windowStart");

-- Booking numbers: BG-<year>-<6 digits>. One global sequence (never resets).
-- Gaps are possible: sequences don't roll back with failed inserts.
CREATE SEQUENCE "booking_number_seq" AS BIGINT START 1;

-- A booking past PENDING always has a physical room.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_room_required_after_confirm"
  CHECK ("status" IN ('PENDING', 'CANCELLED') OR "roomId" IS NOT NULL);

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_child_price_non_negative" CHECK ("childPricePerNightNpr" >= 0);
ALTER TABLE "room_types"
  ADD CONSTRAINT "room_types_child_price_non_negative" CHECK ("childPricePerNightNpr" >= 0);

-- An enquiry needs some way to reply.
ALTER TABLE "enquiries"
  ADD CONSTRAINT "enquiries_contact_required"
  CHECK (COALESCE(BTRIM("email"), '') <> '' OR COALESCE(BTRIM("phone"), '') <> '');
