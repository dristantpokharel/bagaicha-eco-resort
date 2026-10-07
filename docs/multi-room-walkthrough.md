# Multi-room booking walkthrough

Branch: `multi-room-booking`. One request can now include several rooms for the same dates (up to 4 online). Larger groups go to `/enquiry`. Partial confirmation is allowed. Not merged.

## What was done

### Data (migration `20261008000000_multi_room_reservations`)
- New `Reservation`: reference (from the existing `booking_number_seq`, same `BG-YYYY-NNNNNN` format), guest, check-in/out, source, special requests, internal notes, total, timestamps.
- `Booking` is now one room line of a reservation (`reservationId`). It keeps its own room, adults/children, price snapshot, status and timestamps. Its own `checkIn`/`checkOut` stay because the room-overlap exclusion constraint needs them. The constraint is unchanged.
- Reservation status is never stored. It is derived from the rooms: pending / partially confirmed / confirmed / completed / cancelled (`src/lib/booking/reservation-status.ts`). "2 confirmed + 1 cancelled" stays "partially confirmed".
- **Existing data:** each booking becomes a one-room reservation with the same id (old `/admin/bookings/<id>` links keep working) and its booking number as the reference. An assertion block compares every moved value and rolls the whole migration back on any mismatch. Only then are `bookingNumber`, `guestId`, `source`, `specialRequests`, `internalNotes` and `createdById` dropped from `bookings`.
- Tested on the Neon branch `migration-test` (a copy of dev): synthetic old-shape rows in every status, the real copied rows, a deliberately broken backfill (rolls back completely), and the overlap rule still working.
- **Rollback:** Neon snapshot of staging taken before merge (point-in-time restore).

### Guest flow (`/book`)
- Search is unchanged: dates, whole party, optional room-type pill.
- Each room type shows how many rooms are free **for the whole stay** (N distinct rooms, each free every night) with a −/+ stepper. At most 4 rooms in total.
- "Your selection" shares the party across the rooms (adults first, then children) and each room can be edited. Every room goes through the shared capacity rule, and the whole party must be placed. Messages say which room or which guests are the problem.
- If the group fits no single room, a "1× Family Room, 1× Deluxe Room works for your dates" box applies the cheapest combination with the fewest rooms.
- Price: per-room lines from `computeQuote`, then the grand total.
- One form, one submit, one reference, one confirmation listing every room.
- The selection travels in the URL (`lines=` to the form, `pick=` to the chooser), so refresh, back and shared links work. The server validates it again; an out-of-date link returns to the chooser with a notice.
- Calendar shading and "Any room": a night is available if some combination of free rooms, within 4 rooms, holds the party. `/api/availability` now returns free-room counts per night (capped at 4), no room names or booking details.
- Guest steppers allow groups that need several rooms, and stop at what 4 rooms can hold.

### Submit (all or nothing)
In one transaction: room types and prices are loaded from the database, every room is checked against its type, the 4-room limit is applied, and N distinct free rooms are counted for each type. Any problem saves nothing (not even the guest). Turnstile, rate limit and honeypot are unchanged.

### Admin
- `/admin/bookings/[id]` is the reservation page: stay, every room with its own status, guests, price and actions, edit form, guest, history.
- **Confirm all** gives each pending room a free room of its type in one transaction. If any type is short, nothing is confirmed and the message names it.
- Per room: confirm into a chosen room, check in, check out, edit guests / room type / room, cancel with a reason (Admin and Superuser only; Staff still can't cancel). "Cancel the whole booking" cancels everything still cancellable with one reason.
- Moving the dates moves every open room together (each confirmed room is checked again). Dates lock as guests arrive or leave.
- Manual bookings take several rooms; a room on a line confirms that line. Staff are not held to the 4-room limit.
- Bookings list shows one row per reservation (rooms summarised, derived status), with a derived-status filter. Dashboard counts reservations. Calendar draws each room; a click opens its reservation. Guest history lists reservations.
- Reservation total = the rooms that are not cancelled, kept in step in the same transaction as any change.

### Emails
Received (the resort alert lists every room too), confirmed, partially confirmed (confirmed rooms, then rooms that could not be confirmed with reasons, total of the confirmed rooms) and cancelled. All list every room with its guests and price, and escape all user text.

The guest gets **one** email once no room is pending: confirmed, partly confirmed or cancelled. Confirming one of three rooms sends nothing. Cancelling a room later sends a new "partly confirmed" email.

## Tests
- `npm test`: 228 passed (pure logic, emails, pricing, URL state, status rules).
- `npm run test:db:reservations`: 21 passed, against `migration-test` only (`.env.migration-test`, never staging or production). It covers: the migration, N-distinct-rooms availability (rooms free on different nights don't add up), all-or-nothing creation and submit, the 4-room limit, 2 Deluxe + 1 Family pricing, staff-assigned rooms, confirm all (and its all-or-nothing failure), partial confirmation, cancelling, and the list filter matching the derived status for every combination of up to three rooms.
- Typecheck, lint and `next build` pass.

## What to test by hand (`npm run dev`)
1. `/book`, dates and a group of 5 adults + 2 children, "Any room": the suggestion appears; "Use this combination" fills 1 Family + 1 Deluxe; change who stays where; break a room (3 adults in a Deluxe) and read the message; Continue.
2. Open the date picker with the Family Room pill and a group of 5: nights without a free Family Room are hatched.
3. Submit a request (this sends real emails if Resend is configured; `EMAIL_DEV_TO` redirects them). You should get one reference and one email listing every room.
4. `/admin/bookings`: open it. Try **Confirm all**, then a new request where you confirm one room and cancel another with a reason, and check the guest's "partly confirmed" email.
5. `/admin/bookings/new` with two rooms; the calendar bars for each room.
6. Sign in as Staff: confirm works, cancel is hidden.

Screenshots at 1280 and 390px are in `docs/multi-room-screenshots/` (`book-*` public flow, `admin-*` admin).

## Not tested live
- I did not submit the real form in a browser (Turnstile and Resend are external calls). The submit action is tested end to end in vitest with those parts replaced.
- No real email was sent. Please look at the four templates in your inbox.
- Concurrent use is covered by locks and tests of the guard logic, not by a load test.

## Placeholders and open questions
- No new business content. Messages are functional UI text.
- The Deluxe Room description is still a flagged dev placeholder (from before this work); it is hidden in production.
- Question: should staff ever be able to add or remove a room on an existing reservation? Today a reservation's rooms are fixed at creation (you can cancel a room, change its type while pending, or its room once confirmed).
- Question: should a guest who gets a "partly confirmed" email be offered a link back to `/book`? Today the email only asks them to contact the resort.

## Notes
- A booking whose phone or email matches an existing guest joins that guest (as before).
- `.claude/settings.json` now denies reading `.env*` files; `scripts/with-test-db.mjs` is the only way commands should reach the test database (it masks URLs and refuses the dev host).
