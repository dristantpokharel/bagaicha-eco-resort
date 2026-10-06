# Phase 4c walkthrough: stock locations (phase 1 of room setup)

Branch: `phase-4c-stock-locations` (on top of `phase-4b-room-inventory`). Not merged, pushed or deployed.
Phase 2 (par lists, prepare-room and checkout checklists, rooms grid) is **not built**: waiting for your review.

## What was done

### The model
- `InventoryItem.quantity` is still the **total on the property**. Reusable items (`isConsumable = false`) also have a balance per place: **Store**, **Laundry**, and one per **Room**. For a reusable item, total = sum of its balances, always.
- Consumables are unchanged: one total, no places.
- New tables `stock_locations` (kind STORE / LAUNDRY / ROOM, `roomId` for rooms) and `stock_balances` (item × location, never negative). A missing balance row means 0.
- A room's location label and active state come from the room itself (no copied name). New rooms get their location automatically; existing rooms were backfilled.
- `StockMovement` gained `fromLocationId`, `toLocationId`, `bookingId` (all optional) and three types:
  - `TRANSFERRED`: moves stock between places. Stores the amount moved (positive). The total does not change, so **"total = sum of movement quantities" now means every type except TRANSFERRED**.
  - `LOST` and `DAMAGED`: write-offs. Negative, lower the total, require a note.
- `isFixedInRoom` on the item: stays in the room at checkout (used by phase 2). Default **on** for Electric kettle, Drinking glass, Mug, Water jug, Rechargeable lamp, Flashlight, Hanger, Mosquito net, Pillow, Blanket/Quilt. Everything else reusable goes to laundry.

### Rules for reusable items (all in `src/lib/inventory/service.ts`, same row lock and de-duplication token as before)
- **Received** goes into the Store.
- **Adjusted** is a count **at one place** (the form asks where; the default is the Store). The total changes by the difference.
- **Used** is refused ("reusable, so it isn't used up"). Use Move or Lost / damaged.
- **Move** (`transferStock`): from a place that holds enough, to a different active place. Whole-number units stay whole.
- **Lost / damaged** (`writeOffStock`): from one place, note required, optional booking link (the form doesn't offer a booking yet; phase 2 sets it from the checkout inspection).
- Move and write-off are refused for consumables.
- Switching an item between consumable and reusable on the item form: to reusable puts everything on hand in the Store; to consumable is refused unless all of it is in the Store.

### Pages
- **Item form (Admin and up):** two new checkboxes, *Consumable* and *Stays in the room at checkout*.
- **`/admin/inventory/locations`:** Store and Laundry tabs. Store lists reusable items by category with a Move button each. Laundry is a "Move washed items to Store" form: enter how many came back for each item, blank rows skipped, one button, one transaction.
- **`/admin/inventory/move`** and **`/admin/inventory/lost-damaged`:** phone-first forms like Record usage (search, big rows, source place shows how much is there).
- **Item page:** for reusable items, "Where it is" (balance per place) with Move and Lost / damaged buttons, a "Where did you count?" place field when adjusting, and a Place column in the history. Moves show without a +/- sign.
- **Record usage:** the Used list now shows consumables only.
- Inventory list header links to all of the above. Everything above is open to Staff except the item form.

### Database (three migrations, all applied to the dev database)
1. `stock_movement_location_types`: the three enum values (separate because Postgres can't use a new enum value in the migration that adds it).
2. `stock_locations_and_balances`: tables, columns, constraints, and the backfill below.
3. (Earlier, in Part A) `inventory_is_consumable`.

Constraints added: a location is a ROOM exactly when it has a room; only one Store and one Laundry; balances ≥ 0; movement signs per type (LOST/DAMAGED negative, TRANSFERRED positive); TRANSFERRED needs two different places; LOST/DAMAGED need a place.

**Backfill and check.** The migration creates Store, Laundry and one location per room (2 today), puts every reusable item's on-hand quantity into the Store, then **fails and rolls back if any reusable item's total differs from its balances**. The dev database holds 0 stock (it was reset), so I also re-ran the same backfill SQL inside a rolled-back transaction after giving three reusable items quantities: 0 mismatches. `npm run inventory:check` is a read-only check you can run any time (currently: 39 reusable items, OK).

### Seed
`seed:inventory` now sets `isFixedInRoom` on the ten items above when it creates them. It still never edits existing items; the dev database got the flag from the migration.

## Checks run
- `npm run typecheck`, `npm run lint`, `npm run build`: clean. `npm test`: 99 pass + new schema tests.
- `npm run test:db` (dev database, removes only its own rows): 21 pass, including 11 new: Store receipt, move keeps the total, over-move refused with nothing changed, two simultaneous moves (only one wins), write-offs, note required, counts per place, consumable/reusable separation, repeat token, CHECK constraints, total = balances.
- **Not tested in a browser.** I have no login for your dev site, so I only confirmed that the new pages redirect to the login page when signed out. Please run the checklist below.

## Signed-in checklist
Use an Admin first, then a Staff user on a phone (or narrow window).
1. **Item form (Admin):** open "Bed sheet". It shows *Reusable* and goes to laundry. Open "Mug": *stays in the room* is ticked. Untick and save, then re-tick.
2. **Receive:** on Bed sheet, Record stock → Received 10. Item page shows "Where it is: Store 10 pcs".
3. **Move:** Move stock → Bed sheet, Store → Laundry, 4. Item shows Store 6, Laundry 4, total still 10. History shows "Moved", Store → Laundry, no +/-.
4. **Too much:** try to move 7 from Store. You get "Only 6 pcs at Store".
5. **Washed:** Store and laundry → Laundry tab, enter 3 for Bed sheet, press the button. Laundry 1, Store 9.
6. **Lost / damaged:** Bed sheet, Damaged, from Laundry, 1, no note → asked for a note. With a note → total 9. Activity log shows `stock.damaged`.
7. **Count:** Record stock → Adjusted, "Where did you count?" Store, enter 8 with a note → total 8.
8. **Used:** on Record usage, with Used selected, reusable items such as Bed sheet are not listed. Soap bar (consumable) still works.
9. **Flip:** on Bed sheet (stock in Store), untick Consumable? It should now be allowed only because everything is in the Store; put some in Laundry first and see the refusal. (Re-tick afterwards.)
10. **Rooms:** create a test room in Rooms; Move stock → destination list includes it.
11. Run `npm run inventory:check` → OK.

## Open questions / notes
- Opening quantity on the **new item** form for a reusable item goes into the Store.
- Room locations appear in the Move destination list but there is no rooms view yet (phase 2 grid).
- The dev database now has two test rooms' locations and 90 catalog items at 0 stock; test the checklist with small numbers and clear them with Adjusted counts or tell me to reset the inventory rows again.
- Phase 2 still to build: par lists (Admin editable), prepare-room and checkout-inspection checklists, rooms × items grid, "rooms needing prep today".
