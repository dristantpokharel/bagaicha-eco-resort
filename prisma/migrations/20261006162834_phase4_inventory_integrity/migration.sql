/*
  Warnings:

  - Added the required column `balanceAfter` to the `stock_movements` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "balanceAfter" DECIMAL(10,2) NOT NULL;

-- Constraints Prisma can't express (docs/spec.md §3: integrity rules).
ALTER TABLE "inventory_items"
  ADD CONSTRAINT "inventory_items_quantity_non_negative" CHECK ("quantity" >= 0),
  ADD CONSTRAINT "inventory_items_threshold_non_negative" CHECK ("lowStockThreshold" >= 0),
  ADD CONSTRAINT "inventory_items_unit_cost_non_negative" CHECK ("unitCostNpr" IS NULL OR "unitCostNpr" >= 0);

-- Signed quantity: RECEIVED adds, USED removes, ADJUSTED is either but never zero.
ALTER TABLE "stock_movements"
  ADD CONSTRAINT "stock_movements_quantity_matches_type" CHECK (
    "quantity" <> 0
    AND ("type" <> 'RECEIVED' OR "quantity" > 0)
    AND ("type" <> 'USED' OR "quantity" < 0)
  ),
  ADD CONSTRAINT "stock_movements_balance_non_negative" CHECK ("balanceAfter" >= 0);

-- Item names are unique regardless of case ("Rice" vs "rice").
CREATE UNIQUE INDEX "inventory_items_name_lower_key" ON "inventory_items" (lower("name"));
