# Invoices walkthrough

## What is implemented

- Admin and Superuser can issue, mark paid, void, and email invoices. Staff can find, view, and print invoices.
- Reservation invoices copy the guest, eligible room lines, saved standard rates, dates, and booking extras at issuance. Only Confirmed, Checked-in, and Checked-out room lines are included; Pending and Cancelled lines are skipped.
- Admin+ can issue standalone invoices with bill-to contact details, invoice date, optional stay dates, and free-form Charge, Tax, and Discount lines. Existing guest records can prefill the contact form; staff can save the entered contact as a guest.
- Standalone invoices use the same number sequence and payment, void, print, email, snapshot, and activity rules. Admin+ can link an unlinked ISSUED standalone invoice to a reservation once; this does not change its standalone source.
- Room discounted rates default to the saved standard rate. Issue forms accept additional Charge, Tax, and Discount lines, with optional references. Percentage tax is rounded to whole NPR at issue time and stored as an amount.
- Totals show Subtotal (rooms and charges), Tax, Discounts, and Amount due. Booking extras with a zero price print as “Included”.
- Guest print and email use one table with Description, Rate / night, Nights, and Amount. Room standard rate is retained in the snapshot and shown only in the staff screen.
- Invoice numbers use `INV-YYYY-NNNNNN`, with the year determined in `Asia/Kathmandu` and a dedicated database sequence.
- Issued line snapshots are immutable in application code and by a database trigger. Corrections require voiding and reissuing.
- Invoice list supports Reservation / Standalone source, status, payment method, issued-date range, and search by number, guest, or booking reference.
- Print layout uses A4 portrait and hides admin navigation and controls. Email uses the existing email layer and its dev/staging redirect rules; it contains invoice details and no link.
- PAN/VAT and footer note are editable under Admin → Website → Business info. Both remain flagged as placeholders until set.
- Issuance, payment, void, and email attempts are written to the activity log.

## What to test

1. Issue from a reservation with Confirmed, Pending, and Cancelled rooms; verify only eligible lines are copied. A reservation with no eligible rooms must be refused.
2. Add Charge, percentage and fixed Tax, and Discount lines. Verify live totals and that percentage tax rounding is saved at issuance.
3. Issue a standalone invoice with and without optional stay dates, using new and existing guest details. Test Save as guest and verify the copied details remain unchanged if the guest record changes.
4. Add standalone Charge, Tax, and Discount lines with quantities and rates. Verify the invoice source filter, shared number sequence, guest print/email table, and amount due.
5. Link an ISSUED standalone invoice to a reservation; verify activity history and that PAID or VOID invoices cannot be linked.
6. Verify a zero-priced booking extra prints as “Included”; test above-standard room permission.
7. Mark invoices paid with each payment method, then test void rules and standalone or reservation reissue.
8. As Staff, verify view/print access and no issue, payment, void, or link controls. Print to PDF and email a test invoice.
9. With a dedicated disposable Postgres connection in `INVOICE_TEST_DATABASE_URL`, run `npx vitest run src/lib/invoice/invoice-migration.db.test.ts` to check database protections.

## Migration and placeholders

- The invoice migrations have not been applied. Run each command against dev, in order, to execute its SQL inside a transaction that always rolls back:
  - `npm run db:dryrun-migration -- prisma/migrations/20261117000000_invoices/migration.sql`
  - `npm run db:dryrun-migration -- prisma/migrations/20261120000000_invoice_adjustment_lines/migration.sql`
  - `npm run db:dryrun-migration -- prisma/migrations/20261121000000_standalone_invoices/migration.sql`
- PAN/VAT and the invoice footer note remain placeholders until the resort supplies or verifies their values.
- No paid PDF service is used; staff can choose browser Print to PDF.
