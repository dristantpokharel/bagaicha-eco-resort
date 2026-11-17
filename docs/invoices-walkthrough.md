# Invoices walkthrough

## What is implemented

- Admin and Superuser can issue, mark paid, void, and email invoices. Staff can find, view, and print invoices.
- Each reservation has at most one active invoice. A void invoice can be replaced.
- Issuance includes only Confirmed, Checked-in, and Checked-out room lines. Pending and Cancelled lines are excluded. If there are no eligible lines, the page explains why issuance is unavailable.
- Invoice room rates, guest details, reservation dates, and booking extras are copied when issued. Discounted rates default to each saved booking rate. Child charges stay as saved on the booking line. Extra prices default to zero and print as “Included”.
- Invoice numbers use `INV-YYYY-NNNNNN`, with the year determined in `Asia/Kathmandu` and a dedicated database sequence.
- Amounts are stored as whole NPR. Summary values are standard-rate subtotal, total discount, and amount sent. There are no tax or service-charge fields.
- The database migration adds a partial unique index, prevents snapshot edits and deletion, and restricts valid payment and void transitions.
- Admin invoice list supports status, payment method, issued-date range, and search by invoice number, guest, or booking reference.
- Invoice print layout uses A4 portrait and hides the admin navigation, header, and action controls. Email uses the existing Resend layer, including dev and staging redirects; the email contains the invoice details without a link.
- PAN/VAT and footer note are editable under Admin → Website → Business info. Both remain flagged as placeholders until populated or reviewed with a value.
- Invoice issuance, payment, void, and each email attempt are written to the activity log.

## What to test

1. As Admin, open a reservation with a mix of Confirmed, Pending, and Cancelled rooms. Issue an invoice and verify only the Confirmed line is copied.
2. Open a reservation containing only Pending or Cancelled lines and verify the clear ineligible-reservation message.
3. Change a booking or business rate after issuance and verify the invoice remains unchanged.
4. Enter a discount, a zero-priced extra, and a priced extra; verify the live totals, printed “Included” label, and saved amounts.
5. Try an above-standard room rate with and without the Admin+ checkbox.
6. Mark an invoice paid using each payment method, with a date and note. Verify Staff can view/print but cannot change it.
7. Void an issued invoice and issue a replacement. Verify a paid invoice can only be voided by Admin+ and requires a reason.
8. Filter/search the invoice list. Print to PDF and inspect A4 layout, logo, details, and footer. Email to a staging/dev address and verify the redirect behavior.
9. With a dedicated disposable Postgres connection in `INVOICE_TEST_DATABASE_URL`, run the opt-in database protection test: `npx vitest run src/lib/invoice/invoice-migration.db.test.ts`.

## Placeholder and rollout notes

- PAN/VAT and the invoice footer note are intentionally unset placeholders until the resort supplies them.
- The schema and additive migration are prepared, but the migration has not been applied. The required rolled-back dev dry-run still needs access to the dev database connection.
- No PDF service was added; staff can use the browser’s Print to PDF.
