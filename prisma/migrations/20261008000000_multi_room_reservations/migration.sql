-- Multi-room booking: a Reservation (one guest request or stay) owns one or more room lines (bookings).
--
-- Existing data is kept: every booking becomes a one-room reservation. The reservation takes the
-- booking's id (so old /admin/bookings/<id> links keep working) and its booking number as the
-- reference. The columns that moved to the reservation are dropped only after a check that every
-- value arrived intact; if any check fails the whole migration is rolled back.

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "source" "BookingSource" NOT NULL,
    "specialRequests" TEXT,
    "internalNotes" TEXT,
    "totalPriceNpr" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- AlterTable (nullable until the backfill has run)
ALTER TABLE "bookings" ADD COLUMN "reservationId" TEXT;

-- Backfill: one reservation per existing booking.
INSERT INTO "reservations" (
    "id", "reference", "guestId", "checkIn", "checkOut", "source", "specialRequests", "internalNotes",
    "totalPriceNpr", "createdById", "createdAt", "updatedAt"
)
SELECT
    "id", "bookingNumber", "guestId", "checkIn", "checkOut", "source", "specialRequests", "internalNotes",
    "totalPriceNpr", "createdById", "createdAt", "updatedAt"
FROM "bookings";

UPDATE "bookings" SET "reservationId" = "id";

-- Prove the copy before anything is dropped.
DO $$
DECLARE
    bookings_n BIGINT;
    reservations_n BIGINT;
    unlinked_n BIGINT;
    mismatched_n BIGINT;
BEGIN
    SELECT count(*) INTO bookings_n FROM "bookings";
    SELECT count(*) INTO reservations_n FROM "reservations";
    IF bookings_n <> reservations_n THEN
        RAISE EXCEPTION 'Reservation backfill: % bookings but % reservations', bookings_n, reservations_n;
    END IF;

    SELECT count(*) INTO unlinked_n FROM "bookings" WHERE "reservationId" IS NULL;
    IF unlinked_n <> 0 THEN
        RAISE EXCEPTION 'Reservation backfill: % bookings have no reservation', unlinked_n;
    END IF;

    SELECT count(*) INTO mismatched_n
    FROM "bookings" b
    JOIN "reservations" r ON r."id" = b."reservationId"
    WHERE r."reference" IS DISTINCT FROM b."bookingNumber"
       OR r."guestId" IS DISTINCT FROM b."guestId"
       OR r."checkIn" IS DISTINCT FROM b."checkIn"
       OR r."checkOut" IS DISTINCT FROM b."checkOut"
       OR r."source" IS DISTINCT FROM b."source"
       OR r."specialRequests" IS DISTINCT FROM b."specialRequests"
       OR r."internalNotes" IS DISTINCT FROM b."internalNotes"
       OR r."totalPriceNpr" IS DISTINCT FROM b."totalPriceNpr"
       OR r."createdById" IS DISTINCT FROM b."createdById"
       OR r."createdAt" IS DISTINCT FROM b."createdAt";
    IF mismatched_n <> 0 THEN
        RAISE EXCEPTION 'Reservation backfill: % reservations differ from their booking', mismatched_n;
    END IF;
END $$;

-- The line now requires its reservation.
ALTER TABLE "bookings" ALTER COLUMN "reservationId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_createdById_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_guestId_fkey";

-- DropIndex
DROP INDEX "bookings_bookingNumber_key";

-- DropIndex
DROP INDEX "bookings_guestId_idx";

-- AlterTable: these now live on the reservation.
ALTER TABLE "bookings" DROP COLUMN "bookingNumber",
DROP COLUMN "createdById",
DROP COLUMN "guestId",
DROP COLUMN "internalNotes",
DROP COLUMN "source",
DROP COLUMN "specialRequests";

-- CreateIndex
CREATE UNIQUE INDEX "reservations_reference_key" ON "reservations"("reference");

-- CreateIndex
CREATE INDEX "reservations_guestId_idx" ON "reservations"("guestId");

-- CreateIndex
CREATE INDEX "reservations_checkIn_checkOut_idx" ON "reservations"("checkIn", "checkOut");

-- CreateIndex
CREATE INDEX "reservations_createdAt_idx" ON "reservations"("createdAt");

-- CreateIndex
CREATE INDEX "bookings_reservationId_idx" ON "bookings"("reservationId");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Same guards as the room lines have.
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_checkout_after_checkin" CHECK ("checkOut" > "checkIn"),
  ADD CONSTRAINT "reservations_total_non_negative" CHECK ("totalPriceNpr" >= 0);
