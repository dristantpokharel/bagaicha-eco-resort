# Phase 5 walkthrough: Public site

Branch: `phase-5-public-site`. Phase 5 is split in two halves; this file covers **5a (content + homepage)**.
5b (remaining pages and polish) is added below when it is done.

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
