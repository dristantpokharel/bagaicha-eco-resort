# Phase 3 walkthrough: bookings

Branch: `phase-3-bookings`. Not merged, pushed or deployed.

## What was done

### Public booking flow (`/book`)
- Dates and guests → available room types with total price → guest details → submit.
- Labels: **Adults (incl. children 8+)** and **Children under 8**. Children count toward the room's maximum guests.
- Results are a normal URL (`/book?checkIn=…&checkOut=…&adults=…&children=…&room=<slug>`), so Back works and links can be shared.
- Each result shows the breakdown, for example `2 nights × NPR 4,500 = NPR 9,000` and `2 nights × 1 child × NPR 500 = NPR 1,000`, then the total.
- The submit saves a `PENDING` request and shows the booking number. Success only shows after the save committed.
- The server recomputes everything on submit: prices come from the database, and a price field posted by the browser is ignored (covered by a test). It also re-checks the dates, the guest limit, availability, the rate limit and Turnstile.
- Required: name, email, phone. Optional: country, special requests. The phone field starts as `+977 ` and is stored normalized (`+9779812345678`).
- Phone layout was tested at 390 px wide: no horizontal scroll, 16 px field text (so iOS doesn't zoom), full-width buttons, and the summary above the form.
- Over the largest room's capacity, or no availability: the page points to `/enquiry`.
- A hidden honeypot field catches simple bots.

### Enquiry form (`/enquiry`)
- Name, email and/or phone (at least one), type (Custom stay, Event, Conference, Other), message. Turnstile and a rate limit.
- `?type=EVENT` etc. preselects the type.

### Availability and pricing rules (`src/lib/booking/`)
- A room type is available when it has an **active** room with no overlapping `CONFIRMED`/`CHECKED_IN` booking and no overlapping block. `PENDING` requests hold nothing.
- Stays are `[check-in, check-out)`: a guest can arrive the day another leaves.
- Dates are UTC-midnight values and "today" is Asia/Kathmandu. The legacy site used server-local time and per-type overlap; I only ported its overlap rule and its five test cases.
- `total = nights × room rate + nights × children × child rate`. Each booking snapshots `pricePerNightNpr`, `childPricePerNightNpr` and `totalPriceNpr`.
- Public limits: 30 nights, up to 365 days ahead (`src/config/booking.ts`).
- Booking numbers come from a Postgres sequence: `BG-2026-000001`. The counter is global and doesn't reset each year. Failed inserts can leave gaps.
- **Race protection:** confirm, edit, block and room-archive all take a row lock on the room (`SELECT … FOR UPDATE`) and re-check inside the transaction. The exclusion constraint is the last backstop. Its error is mapped to "That room was just booked for overlapping dates. Choose another room or different dates." (tested against the real database).

### Admin
- **Bookings → List:** filters for status, source, room type and stay dates; search by booking number, guest name, email or phone; sort; pages of 25.
- **Bookings → Calendar:** one row per room, one column per night, month navigation. Pending requests with no room appear in their own "Unassigned" rows. Blocks are hatched.
- **New booking:** for phone and walk-in guests. Only name and phone are required. Choosing a room confirms it straight away; leaving it empty saves a pending request. With no email address, the guest email is skipped.
- **Booking page:**
  - **Confirm:** suggests the free rooms and re-checks inside the transaction (room active, right type, no block, no overlap).
  - **Check in:** only on or after the check-in date.
  - **Check out.**
  - **Cancel:** needs a reason; Admin and Superuser only.
  - **Edit:** what can change depends on the status, enforced on the server too.
    - Pending: dates, guests, room type.
    - Confirmed: dates, guests, room.
    - Checked in: check-out date and notes.
    - Closed: notes only.
  - **Repricing on edit:** the booking keeps its own rates. They are only replaced by the new type's current rates if the room type changes.
- **Room blocks** (Admin and Superuser): create and remove, with the reason. A block is refused if a confirmed or checked-in stay overlaps; the message lists the booking numbers.
- **Guests:** search, and each guest's page shows their details (editable) and stay history. Guests are matched by email, then phone. A public request never overwrites an existing guest; it only fills empty fields.
- **Enquiries:** list with status tabs and counts, a status control, and email and WhatsApp links.
- **Dashboard:** today's arrivals and departures, pending requests (how long each has waited), and confirmed stays for the next 14 days.
- **WhatsApp:** a `wa.me` link sits next to guest phone numbers on the booking, guest, list, enquiry and dashboard pages.
- Status flow is checked on the server with the update's WHERE clause including the old status, so two people acting at once can't both succeed. Staff can't cancel (server and UI).
- **Activity log:** booking requested, created, updated, confirmed, checked in, checked out and cancelled; block created and removed; enquiry created and status changed; guest updated; failed emails. Guest contact details are never written to the log.

### Emails (Resend)
- Four emails: request received (guest), new request alert (resort), confirmed, cancelled. I also added a **new enquiry alert** to the resort, because otherwise enquiries would be silent.
- Each shows booking number, dates, nights, room, guests, price breakdown, total, check-in 2:00 PM and check-out 11:00 AM, and the placeholder cancellation policy. Every user-supplied value is HTML-escaped, and subjects can't carry line breaks.
- **Dev mode:** when `EMAIL_DEV_TO` is set, every email goes to that address and the subject begins `[DEV → intended@address]`. Leave it empty in production.
- Emails are sent after the booking is saved. A failed email never undoes a booking: it's logged, and the screen says what happened ("saved, but the email failed").
- `BOOKING_ALERT_TO` is where alerts go. Later, BusinessInfo can override it.

### Rate limiting and Turnstile
- Counters are in Postgres (`rate_limits`), keyed by a keyed hash, so no raw IPs or emails are stored. IP comes from Netlify's header first.
- Bookings and enquiries: 5 per hour per IP. Login: 10 per 15 minutes per IP and 5 per 15 minutes per email. The login limit is enforced inside Auth.js `authorize`, so it can't be bypassed by posting to the Auth.js endpoint directly.
- Turnstile is verified on the server and fails closed (no secret, no token, or an unreachable Cloudflare all reject).

### Database
Migration `phase3_bookings` (additive only):
- `room_types.childPricePerNightNpr` and `bookings.childPricePerNightNpr`.
- `booking_number_seq`.
- `rate_limits` table.
- `enquiries.email` is optional, with a CHECK that email or phone is present.
- CHECK: confirmed, checked-in and checked-out bookings must have a room.

## Environment names
`.env.example` now lists every name. New: **`BOOKING_ALERT_TO`**. `.env.local` already had the rest, but **not `BOOKING_ALERT_TO`**. Please add it (the resort Gmail).

## What I tested
- `npm run typecheck`, `npm run lint`, `npm run build` pass. `npm test` runs 57 tests (dates, overlap, pricing, rules, phone, booking numbers, status flow, calendar maths, schemas, email escaping and dev redirect, Turnstile with a mocked Cloudflare).
- **Live Turnstile call:** one run with Cloudflare's official test keys: the always-pass key passed and the always-fail key failed.
- **Database checks inside rolled-back transactions** (nothing persisted):
  - Availability: pending doesn't block, back-to-back is allowed, blocks and archived rooms are excluded, and a party over capacity is filtered out.
  - Refusals: assigning into a block or over a booking.
  - Constraints: the exclusion constraint is enforced and recognized for the friendly message, and the "confirmed needs a room" CHECK is enforced.
  - Service: the creation service snapshots rates and prices (4,500 × 3 + 2 children × 500 × 3 = 16,500), matches a guest by phone, and refuses a full type.
- **Rate limiter:** blocks after 5, a different identifier is independent, the next window resets, keys are hashed.
- **Browser (Chrome, 390×844):**
  - `/book`: search, check-out auto-moves, results, choosing a room, invalid email and phone show field errors and keep what was typed, then a real submit.
  - The submit created a PENDING booking with the correct price snapshot and a normalized phone, and the page showed `BG-2026-000001`.
  - `/enquiry`: same flow, with `?type=EVENT`.
  - Login throttling: the 6th attempt for one email shows "Too many sign-in attempts".
  - No horizontal scroll and no console errors on any of these.
- **Emails:** five real test emails (received, alert, confirmed, cancelled, enquiry) sent **only** through the `EMAIL_DEV_TO` redirect, with hostile text (`<b>`, `<script>`) in the fields.
- Every new admin route redirects to sign-in when signed out; no secret names appear in the client bundles; every server action that changes data calls `requirePermission` except the two public ones, login and sign-out.

## Not tested (needs you)
- **All signed-in admin pages and actions.** I didn't sign in. Use the checklist below. The queries behind the list, filters, guests and calendar were run read-only against the database.
- Emails to a real guest address (only the dev redirect was used).
- Turnstile with your production keys and domain.

## Cleanup I did
My tests created a booking, guest and enquiry in the dev database. I removed exactly those rows (and their 2 activity entries), after checking the table counts matched, and reset the booking sequence, so your first booking will be `BG-2026-000001`. My rate-limit test rows were also removed.

## Your checklist (signed in)
Before you start: add `BOOKING_ALERT_TO` to `.env.local`; in Rooms, set the child rate to 500 on both room types (a new "Per child under 8" field) and add the Deluxe Room type with its rooms.
1. **Rooms:** edit Family Room: set 500 for children; check Deluxe Room and its 4 rooms exist.
2. **Public request** (signed out or in a private window): `/book` for dates in the next few weeks, 2 adults, 1 child, request a Family Room. Note the number. You should get the guest email and the alert (both arrive at your `EMAIL_DEV_TO` address while it's set).
3. **Dashboard:** the request is under "Pending requests".
4. **Confirm:** open it, confirm the suggested room. You get a confirmation email. The booking shows in the calendar.
5. **Conflict:**
   1. Make a second request for the same dates and room type, until all rooms of that type are taken, and see that the next search says nothing is available.
   2. Create a block on a room under Room blocks, then try to block a room that has a confirmed stay: refused with the booking number.
6. **Edit:** change dates on a confirmed booking to dates where the room is busy: refused. Change the number of children: the total updates.
7. **Check in / out:** a future booking says "Check-in opens on …". On the day, check in and check out.
8. **Cancel:** cancel a pending booking with a reason; the guest gets a cancellation email. Then sign in as **Staff**: no Cancel button, and Room blocks isn't in the Bookings tabs.
9. **Manual booking:** New booking as Phone with no email (guest email is skipped, and the screen says so), then another for the same phone: it joins the same guest's history under Guests.
10. **Guests:** search by name, email and last digits of a phone; WhatsApp link opens `wa.me`.
11. **Enquiries:** submit `/enquiry`, then change its status in the admin.
12. **Login limit:** 6 wrong passwords for one email shows the "too many attempts" message. (Wait 15 minutes, or I can clear the rows.)
13. **Activity log:** entries for each of the above.
14. **Phone:** do the `/book` flow on your own phone.

## Placeholders and open items
- **Cancellation policy is a DEV PLACEHOLDER** (`src/config/booking.ts`). It shows with a visible badge on `/book` and as text in emails. Must be replaced before launch (Phase 6).
- The `/book` and `/enquiry` frame is minimal; the full design arrives in Phase 5.
- `BOOKING_ALERT_TO` must exist in production too.
- Resend can only send from your own domain once it's verified (Phase 6); until then use `EMAIL_DEV_TO`.
- Rate limits and booking limits are my defaults (listed above); they live in `src/lib/rate-limit.ts` and `src/config/booking.ts`.

## Decisions I made that you may want to change
- Check-in is blocked before the check-in date (staff can still edit the date).
- Editing a **pending** booking doesn't check availability (the check happens at confirm).
- Changing a confirmed booking's room type isn't allowed; cancel and rebook, or change the room within the type.
- Staff can create a booking with a room (that confirms it); they can't cancel.

## Housekeeping
- New dev dependency: `vitest` (and `@types/node` moved to `^22`, since Vitest requires it).
- Form controls are now 16 px on phones (14 px from the `sm` breakpoint up), which also applies to the admin.
- The "Book Your Stay" buttons on `/preview` now go to `/book`.
- Uncommitted changes that were already there before I started and that I left alone: the deleted `docs/Logo-with-text.png` and `next-env.d.ts`.
