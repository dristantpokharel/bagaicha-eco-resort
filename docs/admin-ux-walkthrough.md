# Admin usability: walkthrough

Branch `admin-ux`. Part 1 (Today, navigation, search) is built; Part 2 (tape chart) is not started.

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

### Not done yet / open

- Screenshots at 1280 and 390px: not taken. They need a signed-in browser session and I don't read credentials.
- The Today buttons were not exercised against a real database here (the DB test branch isn't configured); they call the same actions the booking page uses.
