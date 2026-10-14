# Housekeeping walkthrough

Branch `inventory-housekeeping`. **Part A is done** (par lists, room status, prep, inspection, board). Part B (booking extras, owner overview, inventory nav) is not started.

## What was built (Part A)

- **Room status** per physical room: Dirty, Ready, Occupied, Out of order (with a note).
  - Check-out sets Dirty, check-in sets Occupied. Both happen inside the existing `transitionLine` transaction, so the Today screen, the reservation page and the tape chart all behave the same.
  - Staff can set Dirty, Ready or Out of order by hand (Housekeeping board → *Change status*). Every change is in the activity log (`room.statusChanged`, with `reason`: checkin, checkout, manual, prep).
  - Out of order needs a note and shows the hint "Block dates on the calendar if it'll be out for a while." It is independent of calendar blocks. Leaving Out of order goes to Dirty, not straight to Ready.
  - Occupied can't be set by hand, and a room with a checked-in guest can't be changed by hand.
- **Check-in warning** (never blocks): checking into a room that isn't Ready asks "Check in anyway?" on the Today screen (single and "check in all") and on the reservation page. Out of order gets a stronger message.
- **Par lists** (Admin and up): *Rooms → room type → Par list*. One list per room type; the room chips on that page edit a single room's list. Only the differences from the type are stored (`RoomParOverride`; 0 means "this room doesn't have it").
- **Prep checklist** (`/admin/housekeeping/rooms/[id]/prep`): par minus what is in the room, one tick or stepper per line, one sticky Complete button. Works on **any Dirty room**, with or without a booking. If the room's next confirmed arrival exists, the prep is linked to it.
  - Reusables move Store → Room. Consumables are recorded as USED for only what staff actually placed (lower any line, down to 0).
  - Store shortfall: the line shows "Store has N". Completing needs a tick on "Complete with the shortfall". It places what exists, the room becomes Ready, the gap is saved on the task and the board shows "Short on stock".
- **Checkout inspection** (`.../inspect`): lists the reusable items the system says are in the room. Staff count them. Non-fixed items (linen, towels) move Room → Laundry; fixed items stay. Anything missing needs Lost or Damaged plus a note and is written off against the booking (so it is linked to the reservation). The room stays Dirty.
- **Housekeeping board** (`/admin/housekeeping`, Front desk group): every active room with status, today's arrival and departure, and a **Prep** or **Inspect** button. Filters: Needs prep, Needs inspection, Out of order.
- **Today screen**: "Rooms to prep for today's arrivals" and "Rooms to inspect". **Tape chart**: a status dot before each room name.
- **Same-day turnaround**: Inspect comes first. Prep is refused ("Inspect it first") until the inspection is done. The board flags it and warns if the room is out of order.

## Decisions that went beyond your answers (please check)

1. **"Needs prep" filter = every Dirty room**, not only rooms arriving today (cleaning happens right after checkout). Rooms with an arrival today sort first.
2. **No skipping an inspection.** Prep is blocked until the stay is inspected. If someone really can't, Change status → Ready clears the pending inspection.
3. **A count above what the system holds is refused** with "correct the count in Record stock first".
4. **Archived items** are left out of prep lists and out of inspections (the move and write-off functions refuse archived items).
5. **Double-completion guard:** each room has a `dirtyCycle` that goes up every time it becomes Dirty. A completed prep or inspection is one row, unique on (room, kind, cycle). The room row is locked first, so the second person sees "*Name* already completed this prep at HH:MM". The same person repeating gets a quiet "already done".
6. **Lock order** is reservation → room → items (sorted by id), so two checklists sharing items can't deadlock.
7. New permissions: `housekeeping.work` (Staff, Admin, Superuser), `inventory.managePar` and `inventory.overview` (Admin, Superuser). `inventory.overview` is not used yet (Part B).

## Database

One additive migration, `20261014204021_housekeeping_status_par_tasks`: new enums, five columns on `rooms`, tables `par_lines`, `room_par_overrides`, `room_tasks`, plus CHECKs (par quantity > 0, override ≥ 0, out of order needs a note). Backfill: existing rooms are Ready, rooms with a checked-in guest are Occupied. The SQL was run on dev inside a transaction and rolled back first (it applied cleanly: 1 Occupied, 5 Ready, nothing left after rollback), then applied with `migrate dev`.

## Checks run

- Typecheck, lint, build: clean. `npm test`: 354 passed, 77 skipped (database tests skip offline).
- Unit tests: status rules, par resolution and saving, prep planning (shortfall, lowering lines, stale/tampered input), inspection planning (lost/damaged, fixed vs laundry), same-day ordering, role matrix, and that every action calls `requirePermission` before touching the database.

## NOT done yet — please run or check

- **The database tests have not been run.** I did not touch env files, so I couldn't. Run `npm run test:db:housekeeping`. Each test runs inside a transaction that is rolled back, so nothing stays in dev. It covers prep, shortfall, inspection with lost/damaged, check-in/out hooks, same-day turnaround, the second-person refusal, and that the database itself rejects a duplicate completion (unique key) and negative stock (CHECKs).
- **A true parallel race** (two requests at the same instant) is not simulated; the tests prove the lock path and the unique key separately.
- **No browser pass yet.** Nothing has been clicked through on a phone-sized screen.

## What to try by hand

1. *Rooms → a room type → Par list*: add a few items (a reusable such as towels, a fixed one such as a kettle, a consumable such as soap).
2. Housekeeping board: set a room Dirty → **Prep** → complete. Check Move/Inventory item pages for the movements, and the activity log.
3. Make the store short on an item and prep again to see the shortfall confirm.
4. Check a guest in (warning appears on a non-Ready room), then out. The room goes Dirty → **Inspect** → leave one item uncounted → pick Lost → note. Check Lost / damaged.
5. Same-day turnaround: a room with a departure and an arrival today.
6. Log in as Staff: Par list link should be absent and `/admin/rooms/<id>/par` should be refused.

## Placeholders / open questions

- No placeholder content. There are no par lists yet, so every prep says "Nothing to place" until you enter them.
- Should the board offer a "skip inspection" button, or is the Ready override enough?
- Part B isn't started. It reuses this prep: extras added before arrival will appear on the prep checklist (the checklist builder already accepts an extras map; the loader will pass it in Part B).
