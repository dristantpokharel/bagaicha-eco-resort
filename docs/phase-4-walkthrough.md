# Phase 4 walkthrough: inventory

Branch: `phase-4-inventory`. Not merged, pushed or deployed.

## What was done

### Items (Admin and Superuser)
- Fields: name, category, unit (pcs, kg, L, box, pack), low-stock threshold, optional unit cost (whole NPR) and supplier, active or archived.
- **Whole numbers only for pcs, box and pack; up to 2 decimals for kg and L.** Enforced in the form schema and again on every movement, on the server.
- **Opening quantity** on the create form is recorded as a first `ADJUSTED` movement with the note "Opening stock". So an item's quantity always equals the sum of its movements.
- **Editing an item never changes its quantity.** Only movements do.
- The unit is locked once any stock has been recorded (changing kg to pcs would make the history meaningless). Archive the item and add a new one instead.
- Names are unique ignoring case (a database index), and a category typed in a different case reuses the existing spelling.
- Archived items disappear from the list (Admins can show them), from low-stock alerts, and can't take movements. History is kept. They can be made active again.

### Stock movements (all roles)
- Types: `RECEIVED`, `USED`, `ADJUSTED`. The movement stores a signed change and the balance after it.
- **One transaction, one row lock:** the item row is locked (`SELECT … FOR UPDATE`), the quantity re-read, the rules applied, then the new quantity, the movement row and the activity entry are written together.
- `USED` can't go below zero. The message says how much is in stock ("Only 3 kg in stock. You can't use 3.01 kg.").
- `ADJUSTED` takes the **counted amount**; the server works out the difference. A note is required. A count equal to the current stock is refused.
- Notes are optional for `USED` and `RECEIVED`.
- Amounts are exact decimals (no floating point).

### Pages
- **`/admin/inventory`:** search (name or supplier), category filter, "Low stock only", Admins also get "Show archived". Each row shows the quantity with its unit, a **Low stock** or **Out of stock** badge, and a Record button. Works at phone width (cards, not a wide table).
- **`/admin/inventory/[id]`:** current quantity and badge, details, the record form (Used, Received, Adjusted), and history (when, who, type, change, balance after, note) in pages of 25. Admins also see the edit form and the archive control.
- **`/admin/inventory/record`:** the phone-first quick form. A search box and large tappable item rows with the current stock, a Used/Received switch, a big numeric amount field, optional note. After saving it shows "Used 2 kg of Rice. 8.5 kg left." and clears for the next entry. The Record button on each list row opens it with that item selected.
- **`/admin/inventory/new`:** Admins only.
- **Dashboard:** a **Low stock** widget (top 10, furthest below threshold first, link to the full filtered list) and a "Record stock" button, for all roles.

### Low stock rule (one function, `isLowStock`)
An item is low when it is active, its threshold is above 0, and quantity is at or below the threshold. A threshold of 0 never alerts. "Out of stock" is a low item at exactly 0.

### Activity log entries
`inventoryItem.created`, `.updated` (with from/to per changed field), `.archived`, `.activated`; `stock.received`, `stock.used`, `stock.adjusted` (item name, change, before, after, note). Repeats of an already-saved submission are not logged twice.

### Double-submit protection (de-duplication token)
- Each record form attempt carries a random token (`submissionId`, unique in the database). The server checks it under the same row lock: a repeat returns "Already saved. Used 2 kg of Rice…" and adds **no** movement and **no** log entry.
- The token is kept after a failure or a lost response, and cleared after a success, so the next entry is new.
- If the request itself fails (flaky connection), the form shows "Couldn't reach the server, so we can't tell if this was saved… tap Record again: it won't be saved twice" instead of crashing.
- A token already used for a different item or user is refused.
- Opening stock on the create form doesn't use a token (an Admin creating an item once).

### Activity log page (`/admin/activity`, Admin and Superuser)
- Newest first, 50 per page, with the total.
- Filters: **user** (including "System / website visitors"), **action**, **from** and **to** dates. The filters are in the URL, and dates use the resort's timezone (Asia/Kathmandu) with the "to" day included.
- Columns: when, who, what, related item, details.
- **Related to** links to the booking, inventory item, guest or room type. Rooms, blocks, enquiries and media link to their list pages. Users link to the Users page, only for Superusers. Removed or deleted things have no link.
- **Guest contact details stay out:**
  - the log never wrote them before (guest updates log field names only);
  - this phase also stops booking edits from logging the text of special requests and internal notes; they now log only that the field was "edited";
  - the page itself never shows keys such as email, phone, WhatsApp, password, token, special requests or internal notes, and replaces any value that looks like an email address or a phone number with `[hidden]`. This also covers entries written before the change.
- Staff emails recorded when a user account is created or changed are hidden too, for the same reason.

### Database
Two migrations, both additive. Applied to the dev database.

`phase4_inventory_integrity`:
- `stock_movements.balanceAfter` (new, required; the table was empty).
- CHECKs: quantity and threshold ≥ 0, unit cost ≥ 0, movement quantity never 0, `RECEIVED` > 0, `USED` < 0, balance ≥ 0.
- Unique index on `lower(name)`.

`phase4_movement_submission_id`: `stock_movements.submissionId` (nullable, unique) for the de-duplication token. `migrate dev` refused to run non-interactively in this session, so I wrote this small migration by hand and applied it with `migrate deploy`; `prisma migrate diff` then reported no difference between the database and the schema.

No seed data: no fake items and no seeded categories. The category field suggests: Linen & housekeeping, Guest toiletries, Kitchen & food, Beverages, Cleaning supplies, Maintenance, Pool, Office (`src/config/inventory.ts`). It's still free text, so staff can type any other category.

## What I tested
- `npm run typecheck`, `npm run lint`, `npm run build`: pass.
- `npm test`: 99 pass. New: movement rules, decimals, whole-number units, low-stock boundaries, quantity formatting, item and movement schemas (including the token), and for the Activity log the filters (Kathmandu day boundaries), contact hiding, labels and links.
- `npm run test:db` (opt-in, uses the dev database, removes only the rows it created): 10 pass.
  - quantity, movement and activity entry are written together;
  - a failed `USED` leaves nothing behind;
  - two simultaneous uses of stock that covers one: exactly one succeeds;
  - quantity equals the sum of movements after a mix of concurrent operations;
  - archived items refuse movements, whole-number units refuse fractions;
  - the CHECK constraints and the case-insensitive name index reject bad rows;
  - a repeated token is recorded once, even when three repeats arrive at the same moment, with one log entry; a token reused for another item is refused.
- **Not tested by me:** the signed-in screens in a browser. I don't have your login, so the checklist below is yours to run.

## Signed-in checklist

### As Admin or Superuser
1. Open **Inventory**. It says no items yet and shows **New item**.
2. New item: "Rice", category "Kitchen", unit kg, threshold 5, opening quantity 12.5. You land on its page with 12.5 kg and a history row "Adjusted +12.5 kg, Opening stock".
3. New item with unit **pcs** and threshold `1.5`: it should be refused with "pcs can't be split".
4. Add "rice" again: refused ("already exists").
5. On Rice, record **Used 8**. Balance 4.5 kg, and a **Low stock** badge appears. Try **Used 10**: refused with "Only 4.5 kg in stock".
6. **Adjusted** with a count of 6 and no note: refused. Add a note: balance 6 kg.
7. Edit Rice: change the supplier and threshold. The unit select is locked.
8. Dashboard: after step 5 (4.5 kg), Rice shows under **Low stock**. After step 6 (6 kg, above the threshold of 5) it disappears from the widget.
9. List: try the search, category filter and "Low stock only".
10. Archive Rice: it leaves the list and the dashboard. "Show archived" brings it back. The record form is replaced by a message. Make it active again.

### As Staff
1. Inventory is in the nav. There is **no** New item button, and an item page has no edit or archive section.
2. Open `/admin/inventory/new` directly: you are sent to the forbidden page.
3. **Record usage** on your phone (or a 390 px window): the fields don't zoom on focus, and tapping an item row selects it. Record Used 1, then Received 3, back to back.
4. On an item page, record an **Adjusted** count with a note.

### Activity log (Admin or Superuser)
1. Open **Activity log**. After the inventory steps above you should see "Stock used", "Stock adjusted", "Inventory item created" and so on, newest first, each linking to its item.
2. Filter by your own user, then by the action "Stock used", then by today's date. "Clear" resets them.
3. Find a booking you edited earlier: special requests and internal notes show `[hidden]` or just "edited", and no email or phone number appears anywhere on the page.
4. As Staff, open `/admin/activity` directly: you are sent to the forbidden page, and the nav has no Activity log item.

### Double submit (any role, phone if you can)
1. On the quick form, enter an amount, then switch your phone to flight mode and tap **Record**. You should see the "Couldn't reach the server…" message, not a crash.
2. Turn the connection back on and tap **Record** again. It saves once. Check the item's history for a single row.
3. Tap the button twice quickly: still one row.

### Anyone
- Open the same item in two browser windows and record a use in both at once, for more than half the stock: one succeeds and the other is refused with the stock message.

## Placeholders and open questions
- No dev placeholders remain in inventory: the category suggestions are the owner's list.
- The token stops a *repeat of the same attempt*. If someone deliberately records the same usage twice (two separate form submissions), that is two movements, as it should be.
- The Activity log hides values that merely look like phone numbers (9 or more digits). A long product code typed into a note could be shown as `[hidden]`. That errs on the safe side.
- Entries made before this phase for booking edits may still hold the old free-text values in the database. The page never shows them. Tell me if you want them scrubbed, which would need a one-off migration.
- `balanceAfter` is stored per movement, so history stays readable even if an old movement were ever corrected.
