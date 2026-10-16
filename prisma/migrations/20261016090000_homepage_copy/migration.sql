-- AlterTable
ALTER TABLE "business_info" ADD COLUMN     "homeAbout" TEXT,
ADD COLUMN     "homeDiningLine" TEXT,
ADD COLUMN     "homeEventsLine" TEXT;

-- Starting text, only where the field is still empty (never overwrites an edit).
-- About: the existing homepage wording from the brochure. Dining: the owner's line.
UPDATE "business_info"
SET "homeAbout" = $t$Bagaicha Eco Resort is a peaceful retreat in the heart of Bardiya, where modern comfort meets nature. Surrounded by greenery and open skies, it’s a place to slow down, reconnect, and enjoy a quiet escape. Wake up to birdsong, fresh air, and the beauty of nature.$t$
WHERE "id" = 1 AND "homeAbout" IS NULL;

UPDATE "business_info"
SET "homeDiningLine" = $t$From local flavours to popular favourites — dine in our restaurant or out in the garden.$t$
WHERE "id" = 1 AND "homeDiningLine" IS NULL;

-- Events line: drafted from the owner's list (weddings, celebrations, meetings, trainings); flagged until reviewed.
UPDATE "business_info"
SET "homeEventsLine" = $t$Weddings, celebrations, meetings and trainings, surrounded by nature.$t$,
    "placeholderFields" = array_append("placeholderFields", 'homeEventsLine')
WHERE "id" = 1 AND "homeEventsLine" IS NULL AND NOT ('homeEventsLine' = ANY ("placeholderFields"));
