# Bagaicha Eco Resort — Product & Technical Spec

> Items marked **[DEFAULT]** are assumptions the owner can change. Ask before deviating from anything else.

## 1. Modules

### 1.1 Public website
- Pages: Home, Stay (rooms), Dine, Explore (activities/experiences), Events, Gallery, Location, Contact, Booking.
- Visual design follows `docs/design.md` and `docs/Brochure.pdf`.
- **Booking request flow:** pick dates → see available room types → enter guest details → submit → booking number shown + confirmation-of-request email.
  - **[DEFAULT]** Guest submissions are **requests** (status `PENDING`); staff confirm them. No instant confirmation.
  - Turnstile on the form; server-side rate limiting.
- **Enquiry form** for custom stays / events / conferences.
- Real loading / error / success states. Never show success unless the save succeeded.

### 1.2 Admin portal (`/admin`)
- **Dashboard:** today's arrivals/departures, pending requests, low-stock items.
- **Bookings:**
  - Calendar view (by room) + list view with filters (status, dates, search by guest/booking number).
  - Create booking manually (phone/walk-in), edit dates/room/guests/notes, assign a specific room.
  - Status flow: `PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT`; `CANCELLED` from PENDING/CONFIRMED.
  - Block dates on a room (maintenance / owner use).
  - Emails on confirm and cancel.
- **Guests:** searchable list, each guest's stay history.
- **Rooms:** room types (name, slug, description, price NPR, max guests, amenities, active) and physical rooms (number/name, type, active).
- **Media:** upload to Cloudinary, alt text, assign to room / gallery category / homepage slot, drag to reorder.
- **Content:** business info, activities/experiences, dining, events, FAQs, policies — editable without code changes.
- **Enquiries:** list + status.
- **Inventory:** see 1.3.
- **Users** (Superuser only): invite/create users, set role, deactivate.
- **Activity log:** who did what, when (bookings, rooms, inventory, users).

### 1.3 Inventory
- Items: name, category, unit (pcs, kg, L, box…), current quantity, low-stock threshold, active.
- **[DEFAULT]** Optional fields: unit cost (NPR), supplier name. No purchase orders.
- Every change is a **stock movement**: `RECEIVED`, `USED`, `ADJUSTED` (count correction / damaged), with quantity, note, user, timestamp. Current quantity = derived from / kept in sync with movements.
- Low-stock list on the dashboard.

## 2. Roles & permissions

| Ability | SUPERUSER | ADMIN | STAFF |
|---|---|---|---|
| Manage users & roles | ✅ | ❌ | ❌ |
| Site content & settings | ✅ | ✅ | ❌ |
| Rooms & prices | ✅ | ✅ | ❌ |
| Media upload / arrange | ✅ | ✅ | ❌ |
| View / create / edit bookings | ✅ | ✅ | ✅ |
| Change booking status (confirm, check-in/out) | ✅ | ✅ | ✅ |
| Cancel bookings | ✅ | ✅ | ❌ **[DEFAULT]** |
| Block dates | ✅ | ✅ | ❌ |
| Inventory items (create/edit/archive) | ✅ | ✅ | ❌ |
| Record stock movements | ✅ | ✅ | ✅ |
| Enquiries | ✅ | ✅ | ✅ |
| Activity log | ✅ | ✅ | ❌ |

- Implement as one permissions map in `src/lib/auth/permissions.ts`; UI hides what a role can't do, server enforces it.
- First SUPERUSER is created by a seed script from `SUPERUSER_EMAIL` / `SUPERUSER_PASSWORD`. The seed must be **idempotent and never delete data**.

## 3. Data model (guide — refine in Phase 1 plan)

- **User**: id, name, email (unique), passwordHash, role (`SUPERUSER|ADMIN|STAFF`), isActive, createdAt, lastLoginAt
- **RoomType**: id, slug, name, description, basePriceNpr (Int), maxGuests, amenities, isActive, sortOrder
- **Room**: id, roomTypeId, name/number, isActive
- **Guest**: id, name, email, phone, country?, notes
- **Booking**: id, bookingNumber (unique, e.g. `BG-2026-000123`), guestId, roomTypeId, roomId? (assigned on confirm), checkIn `@db.Date`, checkOut `@db.Date`, adults, children, status, source (`WEBSITE|PHONE|WALK_IN|OTHER`), priceNpr snapshot (per night + total), currency `NPR`, specialRequests, internalNotes, createdById?, timestamps
- **RoomBlock**: id, roomId, startDate, endDate, reason, createdById
- **Enquiry**: id, name, email, phone, type (enum), message, status, timestamps
- **Media**: id, cloudinaryPublicId, url, width, height, altText, blurDataUrl?, createdAt
- **RoomMedia / GalleryItem / HomepageSlot**: join tables to Media with `sortOrder` (gallery has `category` enum)
- **Content tables**: BusinessInfo (single row), Activity, DiningItem/Section, EventType, Faq, Policy — with `sortOrder` and `isActive`
- **InventoryItem**: id, name, category, unit, quantity, lowStockThreshold, unitCostNpr?, supplier?, isActive
- **StockMovement**: id, itemId, type, quantity (signed or with type), note, userId, createdAt
- **ActivityLog**: id, userId, action, entityType, entityId, details (Json), createdAt

**Integrity rules**
- Foreign keys use `onDelete: Restrict` for anything with history (room types/rooms with bookings, items with movements). Archive via `isActive` instead of deleting.
- Postgres **exclusion constraint** (via SQL in a Prisma migration, `btree_gist`) preventing overlapping `daterange(checkIn, checkOut)` on the same `roomId` for statuses `CONFIRMED` and `CHECKED_IN`. Same idea for RoomBlock vs bookings, enforced in the confirm transaction.
- Availability for a room type = active rooms of that type minus rooms with overlapping confirmed bookings or blocks.

## 4. Build phases (one per agent conversation)

1. **Foundation** — scaffold Next.js + Tailwind + Prisma; full schema + first migration to Neon; Auth.js credentials with roles; `requireUser/requireRole` + permissions map; middleware protecting `/admin`; admin shell with role-aware nav; Users page (Superuser); idempotent seed; `.gitignore` check.
   *Done when:* I can log in as superuser, create an Admin and a Staff user, and each sees only what their role allows; typecheck/lint/build pass.
2. **Rooms & media** — room types + rooms CRUD; Cloudinary upload (signed, server-side); media library with alt text; assign/reorder per room, gallery, homepage.
3. **Bookings** — availability logic (port and review `_legacy/src/lib/availability.ts` and `bookingDateRules.ts`); public booking request + Turnstile + rate limit; admin calendar/list; manual create/edit; room assignment; blocks; status flow; Resend emails (escaped); guests list.
4. **Inventory** — items, movements, low-stock dashboard widget, activity log entries.
5. **Content & public site** — content admin pages; full public redesign per `docs/design.md`; SEO (metadata, sitemap, robots, structured data); accessibility pass.
6. **Launch** — Netlify deploy, env vars, domain, Resend domain verification, production smoke test, remove all dev placeholders.

## 5. Open questions (owner to answer)
- How many physical rooms per room type, and their names/numbers?
- Confirm the **[DEFAULT]** items above.
- Real content: room prices, amenities, activities, dining, policies (cancellation, check-in/out times).