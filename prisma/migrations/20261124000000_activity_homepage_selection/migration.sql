ALTER TABLE "activities"
  ADD COLUMN "showOnHomepage" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "homepageOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "activities"
SET "showOnHomepage" = true,
    "homepageOrder" = "sortOrder"
WHERE "group" = 'AT_BAGAICHA';
