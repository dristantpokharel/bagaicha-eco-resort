-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('DIRTY', 'READY', 'OCCUPIED', 'OUT_OF_ORDER');

-- CreateEnum
CREATE TYPE "RoomTaskKind" AS ENUM ('PREP', 'INSPECTION');

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "dirtyCycle" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "inspectBookingId" TEXT,
ADD COLUMN     "status" "RoomStatus" NOT NULL DEFAULT 'READY',
ADD COLUMN     "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "statusNote" TEXT;

-- CreateTable
CREATE TABLE "par_lines" (
    "roomTypeId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "par_lines_pkey" PRIMARY KEY ("roomTypeId","itemId")
);

-- CreateTable
CREATE TABLE "room_par_overrides" (
    "roomId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_par_overrides_pkey" PRIMARY KEY ("roomId","itemId")
);

-- CreateTable
CREATE TABLE "room_tasks" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "kind" "RoomTaskKind" NOT NULL,
    "cycle" INTEGER NOT NULL,
    "bookingId" TEXT,
    "completedById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lines" JSONB NOT NULL,
    "shortfalls" JSONB,

    CONSTRAINT "room_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "par_lines_itemId_idx" ON "par_lines"("itemId");

-- CreateIndex
CREATE INDEX "room_par_overrides_itemId_idx" ON "room_par_overrides"("itemId");

-- CreateIndex
CREATE INDEX "room_tasks_bookingId_idx" ON "room_tasks"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "room_tasks_roomId_kind_cycle_key" ON "room_tasks"("roomId", "kind", "cycle");

-- AddForeignKey
ALTER TABLE "par_lines" ADD CONSTRAINT "par_lines_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "par_lines" ADD CONSTRAINT "par_lines_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_par_overrides" ADD CONSTRAINT "room_par_overrides_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_par_overrides" ADD CONSTRAINT "room_par_overrides_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_tasks" ADD CONSTRAINT "room_tasks_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_tasks" ADD CONSTRAINT "room_tasks_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_tasks" ADD CONSTRAINT "room_tasks_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integrity rules the application also enforces
ALTER TABLE "par_lines" ADD CONSTRAINT "par_lines_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "room_par_overrides" ADD CONSTRAINT "room_par_overrides_quantity_non_negative" CHECK ("quantity" >= 0);
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_dirty_cycle_non_negative" CHECK ("dirtyCycle" >= 0);
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_out_of_order_has_note"
  CHECK ("status" <> 'OUT_OF_ORDER' OR COALESCE(BTRIM("statusNote"), '') <> '');

-- Backfill: every existing room starts READY (the column default); rooms with guests in them are OCCUPIED.
UPDATE "rooms" SET "status" = 'OCCUPIED'
WHERE "id" IN (SELECT "roomId" FROM "bookings" WHERE "status" = 'CHECKED_IN' AND "roomId" IS NOT NULL);
