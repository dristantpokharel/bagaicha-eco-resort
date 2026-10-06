-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "submissionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_submissionId_key" ON "stock_movements"("submissionId");
