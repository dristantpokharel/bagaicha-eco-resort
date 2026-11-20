# Invoices walkthrough

## What is implemented

- Admin and Superuser can issue, mark paid, void, and email invoices. Staff can find, view, and print invoices.
- Reservation invoices copy the guest, eligible room lines, saved standard rates, dates, and booking extras at issuance. Only Confirmed, Checked-in, and Checked-out room lines are included; Pending and Cancelled lines are skipped.
- Room discounted rates default to the saved standard rate. Issue forms accept additional Charge, Tax, and Discount lines, with optional references. Percentage tax is rounded to whole NPR at issue time and stored as an amount.
- Totals show Subtotal (rooms and charges), Tax, Discounts, and Amount due. Booking extras with a zero price print as “Included”.
- Guest print and email use one table with Description, Rate / night, Nights, and Amount. Room standard rate is retained in the snapshot and shown only in the staff screen.
- Invoice numbers use `INV-YYYY-NNNNNN`, with the year determined in `Asia/Kathmandu` and a dedicated database sequence.
- Issued line snapshots are immutable in application code and by a database trigger. Corrections require voiding and reissuing.
- Invoice list supports status, payment method, issued-date range, and search by number, guest, or booking reference.
- Print layout uses A4 portrait and hides admin navigation and controls. Email uses the existing email layer and its dev/staging redirect rules; it contains invoice details and no link.
- PAN/VAT and footer note are editable under Admin → Website → Business info. Both remain flagged as placeholders until set.
- Issuance, payment, void, and email attempts are written to the activity log.

## What to test

1. Issue from a reservation with Confirmed, Pending, and Cancelled rooms; verify only eligible lines are copied. A reservation with no eligible rooms must be refused.
2. Add Charge, percentage and fixed Tax, and Discount lines. Verify live totals and that percentage tax rounding is saved at issuance.
3. Change a booking rate or guest after issuance and confirm the invoice remains unchanged.
4. Verify a zero-priced booking extra prints as “Included”; test above-standard room permission.
5. Mark an invoice paid with each payment method, then test void rules and reissue.
6. As Staff, verify view/print access and no issue, payment, or void controls. Print to PDF and email a test invoice.
7. With a dedicated disposable Postgres connection in `INVOICE_TEST_DATABASE_URL`, run `npx vitest run src/lib/invoice/invoice-migration.db.test.ts` to check database protections.

## Migration and placeholders

- The additive line migration has not been applied. Run `npm run db:dryrun-migration -- prisma/migrations/20261120000000_invoice_adjustment_lines/migration.sql` against dev to execute it inside a transaction that always rolls back.
- PAN/VAT and the invoice footer note remain placeholders until the resort supplies or verifies their values.
- No paid PDF service is used; staff can choose browser Print to PDF.
