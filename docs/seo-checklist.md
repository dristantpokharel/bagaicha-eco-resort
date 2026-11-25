# SEO checklist (for review before publishing)

Nothing below is live-database content: titles and descriptions are in `src/config/site-copy.ts`, which ships with the code. The homepage and Krishnasaar wording lives in the database, so it is **suggested only**; I did not change any live content.

Target keywords: Bardiya, Gulariya, hotel, lodge, resort, restaurant, food in Gulariya, peaceful stay in Bardiya, resort near Nepalgunj, hotel/resort near Bardiya National Park.

## Titles and meta descriptions in the code
Titles get the suffix " · Bagaicha Eco Resort" from the site template (length in brackets includes it; aim for 60 or fewer). Descriptions: aim for 160 or fewer.

| Page | Title | Meta description | Primary keyword |
|---|---|---|---|
| `/stay` | Hotel & Lodge Stay in Gulariya · Bagaicha Eco Resort (52) | Stay at Bagaicha Eco Resort, a peaceful hotel and lodge in Gulariya, Bardiya. Comfortable rooms surrounded by nature; request your booking online. (146) | hotel and lodge in Gulariya (peaceful stay in Bardiya) |
| `/dine` | Restaurant & Food in Gulariya · Bagaicha Eco Resort (51) | Restaurant and garden dining at Bagaicha Eco Resort in Gulariya, Bardiya: local flavours and warm hospitality, for food in a peaceful setting. (142) | restaurant / food in Gulariya |
| `/explore` | Things to Do in Bardiya · Bagaicha Eco Resort (45) | Things to do around Bagaicha Eco Resort in Gulariya, Bardiya: village walks, birdwatching, pickleball, and trips towards Bardiya National Park. (143) | things to do in Bardiya |
| `/location` | Resort near Bardiya National Park · Bagaicha Eco Resort (55) | Find Bagaicha Eco Resort in Khairi, Gulariya-3, Bardiya, Nepal: a resort near Bardiya National Park and within reach of Nepalgunj, with directions. (147) | resort near Bardiya National Park (and Nepalgunj) |
| `/guides` | Guides · Bagaicha Eco Resort (28) | Guides for planning a peaceful stay in Bardiya, from Bagaicha Eco Resort in Gulariya. (85) | guides for a peaceful stay in Bardiya |
| `/` (home) | from the database: `Bagaicha Eco Resort · <tagline>` | from the database: Business info → Intro line | resort / hotel in Gulariya, Bardiya |
| `/krishnasaar` | from the database: Content → Krishnasaar → Page title | from the database: its Intro | Krishnasaar (Bardiya) |

Pages not changed in this pass: `/events`, `/gallery`, `/contact`, `/faq`, `/policies`.

## Homepage: suggested wording (database, not applied)
Edit in Admin → Content → Business info. Pick what reads naturally; do not paste all of it.
- **Tagline** (becomes the browser title): `Peaceful Resort in Gulariya, Bardiya` (keeps "Bagaicha Eco Resort ·" in front).
- **Intro line** (meta description, under 160 characters): `A peaceful eco resort and hotel in Gulariya, in the heart of Bardiya. Comfortable rooms, garden dining and quiet surroundings. Request your stay online.` (This is also the seed default for new databases.)
- **Homepage: About text**: `Bagaicha is a peaceful eco resort in Gulariya, Bardiya. Stay in quiet, comfortable rooms among greenery and open skies, enjoy food from our restaurant, and explore the area at your own pace.` (Check each statement is true for you.)

In the code (already done): the H1 shows the name with the line "Hotel and eco resort in Gulariya, Bardiya"; the dining band heading is "Restaurant & dining in Gulariya"; the location page heading is "Our location in Gulariya, Bardiya".

## Internal links added
- Stay, Dine, Location: a "Plan your stay" row linking to the other main pages and to Guides; Krishnasaar is added only while that page is live. Explore has the same row without Krishnasaar, because its featured card already links there.
- Homepage band and the Explore featured card link to `/krishnasaar` (only while live).
- Footer link to Krishnasaar (only while live).

## Claims for you to confirm (not facts I could check)
- [ ] "Resort near Bardiya National Park" (location title and description, link text on other pages).
- [ ] "Within reach of Nepalgunj".
- [ ] "Hotel and lodge" wording (stay title and description): confirm both words suit how you describe the property.
- [ ] "Restaurant" and "food in Gulariya": confirm the restaurant is open to non-resident guests, if that is what the wording implies.
- [ ] Trips "towards Bardiya National Park" in the Explore description.

## Structured data
- **Hotel** (every page): `areaServed` is Bardiya, Gulariya and Nepalgunj (from `SERVICE_AREAS` in `src/config/site.ts`).
- **Restaurant** (`/dine` only): added only when there is at least one live dining item. It lists the menu and prices from the database. **No opening hours** are included, because none are stored. If you want hours shown in search, they need a place in Business info first.
- **TouristAttraction, FAQPage, BreadcrumbList** (`/krishnasaar`): built only from live text; nothing is added that is not on the page.

## Image alt text
Images already in the library keep their current alt text (flagged for review in Media → Library). These are **drafts** for photos in `docs/photos/` that have only a filename-based alt text today. I looked at each image and described only what is visible. Please check them before pasting into Media → Library, and tick "alt text reviewed".

| File | Draft alt text |
|---|---|
| `cottages.png` | White single-storey cottages with thatched roofs and a covered veranda, set on a green lawn with tall trees behind |
| `garden.png` | Stone paths through the resort garden past flowering shrubs and a thatched garden shelter, with the guest cottages and wooded hills beyond |
| `family-room-1.png` | A room with several single beds with white bedding, wall lights, air conditioning and a window to the garden |
| `Food.png` | A brass thali plate and a plate of grilled skewers and chicken on a wooden table in the resort garden |
| `restaurant.jpg` | Could not be opened as an image (it is a HEIC file with a .jpg name). Please check it and write the alt text from the photo. |

Notes:
- `Food.png` looks like it may be computer-generated. Confirm it shows your real food before using it on the Dine page (the Media library has an "is placeholder" flag for this).
- I did not add "Bardiya" or "Gulariya" to every alt text on purpose: alt text should describe the picture. Where the place matters (a gate, a river, a village), say so only when it is true of that photo.

## Guide drafts (outlines only, not published)
Added to `prisma/seed-guides.ts`; run `npm run seed:guides` to create them as drafts. Each section says "Owner to write". The text is flagged as a placeholder, so none of them can be published until you write and review them.
1. Staying near Nepalgunj: Bagaicha Eco Resort in Gulariya
2. Resort near Bardiya National Park: what to know
3. Where to eat in Gulariya
4. A peaceful weekend in Bardiya

## Before publishing
- [ ] Review every title and description above.
- [ ] Confirm the claims list.
- [ ] Update the homepage wording in the admin if you agree.
- [ ] Review alt text in Media → Library.
- [ ] Write, review and publish the guides you want.
