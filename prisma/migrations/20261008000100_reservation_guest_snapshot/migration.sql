-- Reservations keep the contact details as submitted, so a request that matches an existing guest no longer
-- shows that guest's old name or phone. The guest link stays for history.
--
-- Existing reservations are backfilled from their linked guest (the best record available). The name column
-- becomes NOT NULL only after the backfill, and the migration fails (rolling back) if any row is left empty.

-- AlterTable
ALTER TABLE "reservations"
    ADD COLUMN "guestName" TEXT,
    ADD COLUMN "guestEmail" TEXT,
    ADD COLUMN "guestPhone" TEXT,
    ADD COLUMN "guestCountry" TEXT;

-- Backfill from the linked guest.
UPDATE "reservations" r
SET "guestName" = g."name",
    "guestEmail" = g."email",
    "guestPhone" = g."phone",
    "guestCountry" = g."country"
FROM "guests" g
WHERE g."id" = r."guestId";

DO $$
DECLARE
    empty_n BIGINT;
BEGIN
    SELECT count(*) INTO empty_n FROM "reservations" WHERE "guestName" IS NULL;
    IF empty_n <> 0 THEN
        RAISE EXCEPTION 'Guest snapshot backfill: % reservations have no guest name', empty_n;
    END IF;
END $$;

ALTER TABLE "reservations" ALTER COLUMN "guestName" SET NOT NULL;
