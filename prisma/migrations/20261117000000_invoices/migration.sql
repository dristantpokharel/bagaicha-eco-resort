CREATE TYPE "InvoiceStatus" AS ENUM ('ISSUED', 'PAID', 'VOID');
CREATE TYPE "InvoicePaymentMethod" AS ENUM ('CASH', 'CHEQUE', 'FONEPAY', 'ESEWA', 'BANK_TRANSFER');

CREATE SEQUENCE invoice_number_seq START WITH 1 INCREMENT BY 1 NO CYCLE;

ALTER TABLE "business_info"
  ADD COLUMN "panVatNumber" TEXT,
  ADD COLUMN "invoiceFooterNote" TEXT;

UPDATE "business_info"
SET "placeholderFields" = ARRAY(
  SELECT DISTINCT field
  FROM unnest("placeholderFields" || ARRAY['panVatNumber', 'invoiceFooterNote']) AS field
)
WHERE id = 1;

CREATE TABLE "invoices" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "reservationRef" TEXT NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
  "guestSnapshot" JSONB NOT NULL,
  "checkIn" DATE NOT NULL,
  "checkOut" DATE NOT NULL,
  "nights" INTEGER NOT NULL,
  "roomLines" JSONB NOT NULL,
  "extraLines" JSONB NOT NULL,
  "standardSubtotalNpr" INTEGER NOT NULL,
  "discountTotalNpr" INTEGER NOT NULL,
  "grandTotalNpr" INTEGER NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "issuedById" TEXT NOT NULL,
  "paidAt" DATE,
  "paymentMethod" "InvoicePaymentMethod",
  "paymentNote" TEXT,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "voidedById" TEXT,
  "emailedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoices_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "invoices_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "invoices_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "invoices_nights_check" CHECK ("nights" > 0),
  CONSTRAINT "invoices_amounts_check" CHECK ("standardSubtotalNpr" >= 0 AND "grandTotalNpr" >= 0)
);

CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");
CREATE INDEX "invoices_status_issuedAt_idx" ON "invoices"("status", "issuedAt");
CREATE INDEX "invoices_paidAt_idx" ON "invoices"("paidAt");
CREATE INDEX "invoices_reservationRef_idx" ON "invoices"("reservationRef");
CREATE UNIQUE INDEX "invoices_one_active_per_reservation_key" ON "invoices"("reservationId") WHERE "status" <> 'VOID';

CREATE FUNCTION protect_issued_invoice() RETURNS trigger AS $$
BEGIN IF ROW(NEW."number", NEW."reservationId", NEW."reservationRef", NEW."guestSnapshot", NEW."checkIn", NEW."checkOut", NEW."nights", NEW."roomLines", NEW."extraLines", NEW."standardSubtotalNpr", NEW."discountTotalNpr", NEW."grandTotalNpr", NEW."issuedAt", NEW."issuedById", NEW."createdAt") IS DISTINCT FROM ROW(OLD."number", OLD."reservationId", OLD."reservationRef", OLD."guestSnapshot", OLD."checkIn", OLD."checkOut", OLD."nights", OLD."roomLines", OLD."extraLines", OLD."standardSubtotalNpr", OLD."discountTotalNpr", OLD."grandTotalNpr", OLD."issuedAt", OLD."issuedById", OLD."createdAt") THEN RAISE EXCEPTION 'Issued invoice snapshots are immutable'; END IF; IF OLD."status" = 'VOID' THEN RAISE EXCEPTION 'Voided invoices cannot be changed'; END IF; IF NEW."status" = 'ISSUED' AND OLD."status" <> 'ISSUED' THEN RAISE EXCEPTION 'Invoice status cannot return to ISSUED'; END IF; IF OLD."status" = 'ISSUED' AND NEW."status" = 'PAID' AND (NEW."paidAt" IS NULL OR NEW."paymentMethod" IS NULL) THEN RAISE EXCEPTION 'Paid invoices require payment date and method'; END IF; IF NEW."status" = 'VOID' AND (NEW."voidedAt" IS NULL OR NEW."voidReason" IS NULL OR btrim(NEW."voidReason") = '' OR NEW."voidedById" IS NULL) THEN RAISE EXCEPTION 'Voiding an invoice requires date, actor and reason'; END IF; IF OLD."status" = 'PAID' AND (NEW."paidAt", NEW."paymentMethod", NEW."paymentNote") IS DISTINCT FROM (OLD."paidAt", OLD."paymentMethod", OLD."paymentNote") THEN RAISE EXCEPTION 'Payment details cannot be changed after marking paid'; END IF; IF NEW."status" <> 'PAID' AND OLD."status" = 'ISSUED' AND (NEW."paidAt" IS NOT NULL OR NEW."paymentMethod" IS NOT NULL OR NEW."paymentNote" IS NOT NULL) THEN RAISE EXCEPTION 'Payment details require a paid invoice'; END IF; IF NEW."status" <> 'VOID' AND (NEW."voidedAt" IS NOT NULL OR NEW."voidReason" IS NOT NULL OR NEW."voidedById" IS NOT NULL) THEN RAISE EXCEPTION 'Void details require a void invoice'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER "invoices_immutable_snapshot_trigger"
BEFORE UPDATE ON "invoices"
FOR EACH ROW EXECUTE FUNCTION protect_issued_invoice();

CREATE FUNCTION prevent_invoice_delete() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'Invoices cannot be deleted; void the invoice instead'; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER "invoices_no_delete_trigger"
BEFORE DELETE ON "invoices"
FOR EACH ROW EXECUTE FUNCTION prevent_invoice_delete();
