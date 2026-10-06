# Phase 5 walkthrough: Public site

Branch: `phase-5-public-site`. Phase 5 is split in two halves; this file covers **5a (content + homepage)**.
5b (remaining pages and polish) follows after the 5a sections.

## 5a: what was done

### Database (migration `20261006191449_phase5_content`)
- `BusinessInfo`: `phones[]` and `emails[]` (main first; the old single `phone`/`email` were copied across before being dropped), `whatsapp`, `intro`, `directionsUrl`, `latitude`, `longitude`.
- `Activity`: `overview` (the old `description`, copied), `duration`, `bestTime`, `whatToExpect`.
- `EventType.highlights`, and a new `NearbyDestination` table.
- `placeholderFields` on every content table and on `RoomType`. A field stays flagged only while its text is unchanged; editing it in admin clears the flag.

### Dev data scripts (dry-run by default; `--apply` writes to the dev DB)
- `npm run setup:deluxe-room`: created the **Deluxe Room** (NPR 3,000/night, max 2, child NPR 500, rooms 201–204, photos room/curtains/towel). Description and amenities are flagged placeholders.
- `npm run media:seed-photos`: added the missing `family-room-1`.
- `npm run place:photos`: hero desktop (`garden` replaced by `hero`), hero mobile, Family Room and gallery photos as you approved. **I also applied the homepage section slots** (ABOUT, STAY, DINE, EXPLORE, EVENTS, CONFERENCE, LOCATION) because the homepage can't be judged with empty slots. Mapping: ABOUT garden/cottages/hero-2; STAY room; DINE food/restaurant; EXPLORE chill-pool; EVENTS wedding-mock then lawn; CONFERENCE conference-room; LOCATION map. All are editable in Media → Homepage.
- `npm run seed:content`: business info, activities, event types, a Restaurant dining section, nearby destinations, placeholder FAQs and policies. Only facts from the brochure, design.md and the old preview. Idempotent; never overwrites.

### Content admin (Content, Admin and Superuser)
Tabs: Business info, Activities, Dining, Events, FAQs, Policies, Nearby. One form definition per collection (`src/lib/content/collections.ts`) drives the form, the validation and the save action. Every save checks `content.manage`, validates with Zod, writes an activity-log entry and refreshes the public site immediately. Items are hidden with "Show on the website" (no deletes, as with rooms).

### Placeholders panel
The admin dashboard (Admin and up) lists every flagged field and the wedding mockup, each linking to where to fix it. In development they show on the site with a **DEV PLACEHOLDER** badge. In production they are hidden, and a row whose title/question/answer is a placeholder is left out entirely. Checked with a production build: no placeholder text or mockup in the homepage HTML.

### Public site
- `(site)` layout: skip link, header (route links, active page, mobile menu), footer, floating WhatsApp button. All from `BusinessInfo`.
- Homepage `/`: hero (desktop and phone photos from placements, preloaded), intro band, Stay/Dine/Explore/Celebrate, layered About, rooms (RoomType + RoomTypeMedia, with "From NPR x / night"), activities accordion, events and conferences, location with nearby list, illustrated map, Get Directions and a **Show map** button that loads the Google embed only when clicked.
- `/preview`, its content file and `preview:photos` are removed. `/book` and `/enquiry` now sit inside the shared layout (restyle is in 5b).

## How to test
1. Restart `npm run dev` (it must load the new Prisma client), then open `/`. Compare with the screenshots in `docs/phase-5-screenshots/` (JPEG, downscaled).
2. Admin → Dashboard: see the Placeholders panel (12 items).
3. Admin → Content → Activities: open Birdwatching, change "Short line", save; reload `/` and see it. Change it back.
4. Edit a placeholder field (e.g. an activity's Duration), save, and check it leaves the Placeholders panel.
5. Hide an activity ("Show on the website" off) and check it disappears from `/`.
6. Phone width (390px): no sideways scroll, menu opens and closes, WhatsApp button is reachable.
7. `Show map` loads the map only after the click (check the Network tab).

## Checks run
Typecheck, lint, 118 tests (new: placeholder rules and content schemas) and a production build all pass. End-to-end in a real browser: logged in, edited through the real form, saw the edit on `/`, restored it (this left two `content.updated` rows in the activity log). Horizontal overflow at 390px: 0px.

## Placeholders (all listed on the dashboard)
Deluxe Room description and amenities; the activity overview, duration, best time and what-to-expect for all five activities, plus the Village Walks and Pickleball short lines; the Restaurant description; two FAQ answers (check-in/out times, cancellation); two policies (cancellation, check-in/out); the wedding mockup photo.

## Open questions
1. Is the homepage section-slot mapping above right? (Change in Media → Homepage.)
2. Photo alt text is still the filename draft ("Hero", "Room"…) and flagged "needs review" in Media. It is what screen readers read, so please review it before launch.
3. Facebook URL and a second WhatsApp/phone number: none given, so they are not shown.
4. The Chill Pool is listed as an activity because the preview did. Move it to Dining if you prefer.


---

# 5b: remaining pages and polish

## Mobile tightening (from your homepage feedback)
Phones only; desktop is unchanged. Section padding is about half of desktop (`--spacing-section-sm` 4rem to 2.5rem, always paired with the desktop value), heading-to-content gaps are 1.5rem instead of 2.5rem, and stacked image groups, the pull-quote block, icon rows and the footer have tighter margins. The 390px page went from 12,120px to 11,264px tall. Before/after: `docs/phase-5-screenshots/mobile-before-after-1.jpg` to `-3.jpg` (left = before, right = after).

## What was added
Every link in the header and footer now has a page. Each reads from the database (nothing hardcoded) and has its own title, description, canonical URL and Open Graph tags (hero photo as the share image).

| Page | What it has |
|---|---|
| `/stay` | Alternating room rows: photos, description, price per night, "children under 8" rate, max guests, amenities, and **Book this room** linking to `/book?room=<slug>` |
| `/dine` | Dining sections and items from Content (prices only when set), photos from the Dine slot |
| `/explore` | Expandable panels (native disclosure, so keyboard and no-JS friendly) |
| `/events` | Weddings and celebrations, conferences and trainings, with CTAs to `/enquiry?type=EVENT` and `?type=CONFERENCE` |
| `/gallery` | Masonry, category filters (only categories that have photos), lightbox with arrows, Esc, focus return |
| `/location` | Address, nearby destinations, illustrated map, Get Directions, Open in Google Maps, click-to-load embedded map |
| `/contact`, `/faq`, `/policies` | From BusinessInfo, FAQs and Policies |

- `/book` and `/enquiry` are restyled (page heading, brochure form controls, square corners, label type) with no change to their behaviour. The room chosen on `/stay` is kept through the date search, and a note says which room you are booking. `/book` now shows room descriptions through the same placeholder-safe path as the rest of the site.
- Event types are Weddings, Birthdays & Celebrations, Private Gatherings and Conferences & Trainings.
- The Chill Pool stays under Explore as an activity.

## SEO
Per-page metadata and canonical URLs (from `NEXT_PUBLIC_SITE_URL`), Open Graph and Twitter cards, `sitemap.xml` (all public pages, no admin or login), `robots.txt` (blocks `/admin`, `/login`, `/api/`), and `LodgingBusiness` JSON-LD on the homepage built only from BusinessInfo fields that are filled in (name, intro, phone, email, address, coordinates, map link, Instagram). `<` is escaped in the JSON-LD.

## Accessibility and performance
- **Checked in a real browser on all 12 public pages:** one `h1` and one `main` each, no skipped heading levels, no images without `alt`, no unnamed links, buttons or fields, no duplicate ids, title, description and canonical present.
- **Contrast:** the one failure (muted text on sage, 3.75:1) was fixed. All other pairs are 4.6:1 or better.
- **Focus:** a baseline visible focus ring for anything without its own; skip link; active page marked with `aria-current`; links that open a new tab say so.
- **Reduced motion:** reveals, fade-ups, hover zooms, accordion rotations and smooth scrolling all stop.
- **Keyboard and screen reader:** gallery filters use `aria-pressed` and announce the count; the lightbox is a native modal dialog (focus trapped, Esc closes, focus returns); the mobile menu has `aria-expanded` and closes on Esc and on navigation.
- **Images:** every image goes through the Cloudinary loader with `sizes`; the hero is preloaded with high priority (and the first photo on Dine and Explore).
- **No horizontal scroll at 390px on any page** (measured).

## How to test
1. Click every header and footer link. None should 404.
2. `/stay`: click Book this room on the Deluxe Room; pick dates; you should go straight to the request form for that room.
3. `/gallery`: try each filter; open a photo and use the arrow keys and Esc.
4. `/location`: Get Directions opens Google Maps; **Show map** loads the embed only after the click.
5. `/events`: both buttons open the enquiry form with the right type preselected.
6. Admin: edit something in Content and see it on the public page straight away.
7. Phone width: open the menu, go through the pages, check the WhatsApp button.
8. `npm run build && npm start`: placeholders and the wedding mockup are hidden everywhere (verified for all public pages).

## Checks run
Typecheck, lint, 124 tests (new: contact links, sitemap, robots, header/footer link consistency) and a production build pass. Browser audit, gallery, lightbox, menu and room-prefill checks all pass.

## Follow-up: single sources, confirmed facts and FAQs
- **Cancellation policy** is now only in Content → Policies ("Plans changed? Please let us know at least 24 hours before your arrival so we can release your room to other guests."). It was removed from `src/config/booking.ts`. `/book`, the booking emails, the FAQ and `/policies` all read it from the database.
- **Check-in 2:00 PM and check-out 11:00 AM** are now Business info fields (migration `business_stay_times`), editable in admin, and removed from the config file. One loader, `loadStayTerms()` (`src/lib/content/stay-terms.ts`), feeds `/book`, the stay summary, the admin booking page and every email. Verified end to end: changing the time in admin changed `/book` and the FAQ straight away, then I restored it.
- **Six FAQs drafted** from confirmed facts only (check-in/out, children's rates, rooms and capacity, how requests and confirmation work, cancellation, location and distance to Nepalgunj). They are flagged as placeholders for your review, so they show with a badge in development and are **hidden in production until you review them**.
- **Facts in FAQ answers are not typed in.** Answers can use tokens such as `{{checkInTime}}`, `{{childRates}}`, `{{rooms}}`, `{{nearby:Nepalgunj}}`, so if a price, time or distance changes the FAQ follows. The token list is shown under the Answer field. If a token has no value saved, the answer is hidden in production.
- **"I have reviewed this and it is final"** tick-box on any flagged item in Content removes the placeholder flag without changing the text. Editing a flagged field also clears its flag.
- The "Check-in and check-out" policy now reads "Check-in is from 2:00 PM. Check-out is by 11:00 AM." from the same fields.

## Placeholders and launch blockers (Phase 6)
- Everything on the dashboard Placeholders panel: the six FAQs (for your review), the Deluxe Room description and amenities, activity details, the Restaurant description and the wedding mockup photo.
- **Children's rate:** the FAQ states each room's rate from the database. The Deluxe Room is NPR 500 per child per night, but the **Family Room is set to free for children** (child rate 0). If the Family Room should also be NPR 500, change it in Rooms.
- Photo alt text is being done in Media (you).
- Until the FAQs are reviewed, `/faq` shows "will be added soon" in production.
- Turnstile shows its widget on `/enquiry` and `/book` in development (existing behaviour).

## Notes
- Scripts that write straight to the database (`place:photos`, `seed:content`) don't refresh the website cache; it catches up within the hour, or immediately on any admin save.
- Screenshots of every page, desktop and phone, are in `docs/phase-5-screenshots/` (JPEG, downscaled).
