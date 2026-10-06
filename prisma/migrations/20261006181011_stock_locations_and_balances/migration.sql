-- CreateEnum
CREATE TYPE "StockLocationKind" AS ENUM ('STORE', 'LAUNDRY', 'ROOM');

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "isFixedInRoom" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "bookingId" TEXT,
ADD COLUMN     "fromLocationId" TEXT,
ADD COLUMN     "toLocationId" TEXT;

-- CreateTable
CREATE TABLE "stock_locations" (
    "id" TEXT NOT NULL,
    "kind" "StockLocationKind" NOT NULL,
    "roomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balances" (
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("itemId","locationId")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_locations_roomId_key" ON "stock_locations"("roomId");

-- CreateIndex
CREATE INDEX "stock_balances_locationId_idx" ON "stock_balances"("locationId");

-- CreateIndex
CREATE INDEX "stock_movements_bookingId_idx" ON "stock_movements"("bookingId");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_locations" ADD CONSTRAINT "stock_locations_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "stock_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Hand-written: constraints, seed rows and backfill ──────────────────────

-- A location is a ROOM exactly when it points at a room; Store and Laundry exist once each.
ALTER TABLE "stock_locations"
  ADD CONSTRAINT "stock_locations_room_matches_kind" CHECK (("kind" = 'ROOM') = ("roomId" IS NOT NULL));
CREATE UNIQUE INDEX "stock_locations_one_per_kind" ON "stock_locations" ("kind") WHERE "kind" <> 'ROOM';

ALTER TABLE "stock_balances"
  ADD CONSTRAINT "stock_balances_quantity_non_negative" CHECK ("quantity" >= 0);

-- Movement signs. RECEIVED adds, USED/LOST/DAMAGED remove, ADJUSTED is either.
-- TRANSFERRED stores the amount moved (positive) and leaves the item total unchanged,
-- so it is the one type left out of "total = sum of movement quantities".
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_quantity_matches_type";
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_quantity_matches_type" CHECK (
    "quantity" <> 0
    AND ("type" <> 'RECEIVED' OR "quantity" > 0)
    AND ("type" NOT IN ('USED', 'LOST', 'DAMAGED') OR "quantity" < 0)
    AND ("type" <> 'TRANSFERRED' OR "quantity" > 0)
  ),
  ADD CONSTRAINT "stock_movements_locations_match_type" CHECK (
    ("type" <> 'TRANSFERRED' OR ("fromLocationId" IS NOT NULL AND "toLocationId" IS NOT NULL AND "fromLocationId" <> "toLocationId"))
    AND ("type" NOT IN ('LOST', 'DAMAGED') OR "fromLocationId" IS NOT NULL)
  );

-- Store and Laundry, plus one location per existing room.
INSERT INTO "stock_locations" ("id", "kind") VALUES (gen_random_uuid()::text, 'STORE'), (gen_random_uuid()::text, 'LAUNDRY');
INSERT INTO "stock_locations" ("id", "kind", "roomId") SELECT gen_random_uuid()::text, 'ROOM', "id" FROM "rooms";

-- Everything reusable on hand starts in the Store.
INSERT INTO "stock_balances" ("itemId", "locationId", "quantity", "updatedAt")
SELECT i."id", s."id", i."quantity", CURRENT_TIMESTAMP
FROM "inventory_items" i
CROSS JOIN (SELECT "id" FROM "stock_locations" WHERE "kind" = 'STORE') s
WHERE NOT i."isConsumable" AND i."quantity" > 0;

-- Default "stays in the room at checkout" items (the owner's list). New catalogs get this from seed:inventory.
UPDATE "inventory_items" SET "isFixedInRoom" = true
WHERE NOT "isConsumable" AND lower("name") IN (
  'electric kettle', 'drinking glass', 'mug', 'water jug', 'rechargeable lamp',
  'flashlight', 'hanger', 'mosquito net', 'pillow', 'blanket/quilt'
);

-- Verify the backfill: every reusable item's total must equal the sum of its balances.
-- If not, this raises and the whole migration rolls back.
DO $$
DECLARE mismatches integer;
BEGIN
  SELECT count(*) INTO mismatches
  FROM "inventory_items" i
  WHERE NOT i."isConsumable"
    AND i."quantity" <> COALESCE((SELECT sum(b."quantity") FROM "stock_balances" b WHERE b."itemId" = i."id"), 0);
  IF mismatches > 0 THEN
    RAISE EXCEPTION 'Stock backfill left % reusable item(s) whose total differs from their balances', mismatches;
  END IF;
END $$;
