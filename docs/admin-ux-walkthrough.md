# Admin usability: walkthrough

Branch `admin-ux`. Part 1 (Today, navigation, search) and Part 2 (tape chart) are built.

## Part 1

### What was done

- **Today screen** (`/admin`, replaces the dashboard). All times use Asia/Kathmandu. Header: date, "Tonight: n of N rooms occupied" (distinct active rooms with a confirmed or checked-in stay covering tonight), New booking, and a link to new enquiries when there are any.
  - **Arrivals today**: per room "Check in", plus "Check in all" when two or more rooms are confirmed. A room with no room number yet shows a picker of the free rooms of its type for the whole stay and "Assign & confirm". Rooms already checked in stay on the card, marked as such.
  - **Departures today**: per room "Check out", plus "Check out all".
  - **In-house now**: checked-in guests who stay past today (those leaving today are under Departures).
  - **Pending requests**: how long each has waited, "Confirm" (confirms every pending room of the request, each into a free room of its type, all or nothing, same as the booking page) and "Open". Oldest first, 10 shown.
  - **Next 7 days**: arriving and leaving rooms per day, each linking to the booking list for that day.
  - **Low stock** and the placeholder report (Admin and above) as before.
  - Every button calls the existing server action (`checkInLine`, `checkOutLine`, `confirmLine`, `confirmAllLines`); permissions and checks are unchanged. Check in/out/confirm need `bookings.changeStatus`. There is no cancel on this screen, so Staff can't cancel from it. "Check in all" calls the single-room action once per room and stops at the first refusal, saying how many went through.
- **Navigation** in groups (Front desk, Property, Website, Settings), built from one list in `src/lib/admin-nav.ts`; items the role can't open are not shown. Desktop: sidebar with group labels. Phones (under 768px): bottom tab bar (Today, Bookings, Calendar, Inventory, More) with 44px+ targets, active state and the iOS safe-area inset; "More" opens a sheet with the rest by group, the signed-in user and Sign out. Page content has extra bottom padding on phones. Active state picks the most specific match, so Calendar doesn't light up Bookings.
- **Search** in the header: Ctrl/⌘+K, or the magnifier on phones (full screen). Finds bookings (reference, guest name, email, phone), guests, enquiries and inventory items, each only if the role may see that section. Grouped results with status chips, arrow keys + Enter, Esc to close, 250 ms debounce, at least 2 characters. Phone numbers match on their digits from 3 digits up (so the last digits work). It is a server action (POST), so the text never appears in a URL, and it never writes to the activity log.
- New shared pieces: `Sheet` (native `<dialog>`, `src/components/ui/sheet.tsx`, reused by Part 2's confirm dialog), `src/lib/admin/{today,search}.ts`.
- Enquiry cards got an `id` anchor so a search hit scrolls to and highlights the enquiry.

### Choices worth knowing

- "In-house now" excludes guests leaving today, to avoid listing them twice.
- Pending "Confirm" auto-assigns rooms; choosing a specific room is on the arrival card ("Assign & confirm") or the booking page.
- Staff can search every kind today (all four permissions are in the Staff role). The filter is tested by narrowing the role's permissions.

### How to test

1. Sign in as Superuser, open `/admin`. Check the date, tonight's count, and that each section matches the booking list.
2. Create a booking arriving today with two rooms (one confirmed with a room, one pending). Check in the confirmed room, use "Assign & confirm" on the other, then "Check out" the next day or by moving dates.
3. With a 390px window: tab bar visible, sidebar hidden, More opens the sheet, nothing hidden behind the bar when scrolled to the bottom.
4. Press Ctrl/⌘+K, type a guest's name, the last 4 digits of their phone, a reference, an item name. Arrow keys, Enter. Confirm the activity log has no search entries.
5. Sign in as Staff: no Rooms, Content, Media, Users or Activity log in the nav; no cancel anywhere on Today.

### Tests added

`src/lib/admin-nav.test.ts` (role filtering, tab bar vs More, active item), `src/lib/admin/search.test.ts` (min length, phone digits, permission filtering, no activity-log write), `src/lib/admin/today.test.ts` (Kathmandu date, tonight's count, arrivals with unassigned rooms and their free rooms, pending wait text, next 7 days, no data without booking access).

### Fixed after testing on a phone

- The "More" sheet showed only a dimmed page in Safari. The dialog's content sat in a `height: 100%` box inside an auto-height dialog; the dialog is now itself the flex column (`src/components/ui/sheet.tsx`). Confirmed working on an iPhone.

### Open

- The Today buttons were not exercised against a real database here (the DB test branch isn't configured); they call the same actions the booking page uses.

## Part 2: tape chart (`/admin/bookings/calendar`)

### What was done

- **Grid:** rooms as rows grouped by type, days as columns; sticky room column and date header; today highlighted; **2 weeks / Month** toggle plus Previous / Today / Next (`?view=2w&from=date` or `?month=YYYY-MM`; old `?month=` links still work and show the month view). Horizontal scroll on phones. Pending rooms sit in "Unassigned" rows per type (as few rows as needed so bars don't overlap).
- **Create:** click an empty night (or drag across several in one room) to go to New booking with the room and dates filled in (`/admin/bookings/new?room=…&checkIn=…&checkOut=…`). Admin and above get a small chooser instead, with New booking and **Block these dates** (reason, then the existing block action). A drag only extends over free nights.
- **Move and resize** (`@dnd-kit`, mouse and touch):
  - drag a bar to another room **of the same type** (rows of other types dim while dragging);
  - drag sideways to shift the stay;
  - drag a bar's left or right edge for check-in / check-out;
  - drag an Unassigned bar onto a room to **assign and confirm** it (for the dates it already has; sideways movement is ignored on that drop);
  - checked-in stays: only the check-out edge; checked-out and cancelled stays can't be dragged; blocks can be moved and resized by Admin and above.
  - While dragging, a dashed ghost shows where it would land (green valid, red invalid) and the line above the chart says why a target is refused.
- **Every drop opens a confirm dialog**: the room change, the old and new dates, the price before and after (each room repriced from its own saved rates), and, for a date change, "This moves all N rooms of BG-…". "Email the guest the updated details" is ticked by default for date changes and off for room swaps (disabled if the guest has no email). Then the server re-checks everything (reservation and room locks, free and unblocked room, status and date rules, the database overlap constraint) and a refusal is shown in the dialog.
- **Toast with Undo (10 seconds)** after a move or block change. Undo calls the same action with the old values, so the same checks apply and it can be refused if the spot was taken meanwhile. If the original change emailed the guest, the Undo emails the guest again. Assign-by-drop has no Undo (a confirmed room can't go back to pending); the toast says so in the dialog beforehand.
- **Availability cache** is invalidated by every change (same as the booking actions).
- **Phones:** touch and hold (about 0.35 s) to drag; a normal swipe scrolls the chart.
- **No-drag alternative:** tap or press Enter on a bar for a panel with its details, a link to the booking and a **Move / change dates** form (room, check-in, check-out) that goes through the same confirm dialog.
- **New email "booking updated"** (`modified`): guest only, HTML-escaped, lists every room still booked, the new dates and the new total.
- **Permissions:** Staff can create, move and resize bookings; moving or creating blocks needs `rooms.blockDates` (Admin and above), enforced in the server action as well as hidden in the UI. Assigning needs `bookings.changeStatus` (the existing confirm action).

### Choices worth knowing

- **Dates belong to the booking.** Moving or resizing one room's dates moves every open room of that reservation (the existing rule); there is no splitting. The dialog says so. For a one-room booking there is no difference.
- A pending request can't change room and dates in one drop (assign first, then change dates).
- Keyboard users use the tap/Enter panel rather than dragging with the keyboard.
- `Sheet` ignores backdrop clicks for 0.4 s after opening: the tap that opens a dialog from a chart cell is followed by a click that would otherwise close it at once.
- Shared code: the date-moving part of `updateReservation` is now `moveOpenLines` in `reservation-service.ts`, used by both the booking page and the chart.

### How to test

1. Open `/admin/bookings/calendar`; switch 2 weeks / Month; use the old `?month=2026-10` link.
2. Drag a confirmed stay to a free room of the same type, then to a busy one (red ghost, refusal), then to another type (dimmed, refused).
3. Drag a stay sideways and by each edge; check the dialog's price. Try it on a two-room booking and read the "moves all 2 rooms" line. Tick and untick the email box and confirm; use Undo within 10 seconds.
4. Drag an Unassigned bar onto a room: assign and confirm. On a checked-in stay only the right edge moves.
5. As Admin: click empty nights, choose Block, then drag the block. As Staff: no chooser (straight to New booking) and blocks don't move.
6. On a phone: swipe scrolls, press and hold drags, tap a bar for the form.

### Tests added

`src/lib/booking/tape.test.ts` (capabilities, free and busy rooms, conflicts including the other rooms of the booking, type change, checked-in edge only, assign-by-drop, blocks, price impact, email defaults, lanes, selection), `tape-service.test.ts` (the status and date rules the server applies), `src/app/admin/bookings/tape-actions.test.ts` (permissions: Staff refused for blocks, allowed for bookings; undo payloads; email-again rule; refusals and the overlap-constraint message), `calendar.test.ts` (range parsing), the email test for the new template, and `tape-service.db.test.ts` (move to a free or busy room, extending into a conflict, type change, checked-in, undo and a refused undo, assign-by-drop, blocks, two moves racing). The DB tests are in `npm run test:db:reservations` and **have not been run**: they need the throwaway database branch, which isn't configured here.

### Checked in a browser

Chromium at 1280px and 390px (touch), on the real chart component with sample data and no sign-in: drags (free, busy, other type, sideways, multi-room, assign), the confirm dialog, a server refusal shown in the dialog, the tap-a-bar form, empty-cell tap to New booking and to the Admin chooser, swipe versus long-press. Not run: the full flow against the real database (confirming a move, Undo, the email), and WebKit (it can't open pages in this sandbox).
