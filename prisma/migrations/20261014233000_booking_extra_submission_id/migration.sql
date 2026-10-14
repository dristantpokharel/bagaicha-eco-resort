-- AlterTable
ALTER TABLE "booking_extras" ADD COLUMN     "submissionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "booking_extras_submissionId_key" ON "booking_extras"("submissionId");
