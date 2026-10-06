# Phase 1.5 walkthrough: design preview

Branch: `phase-1.5-design`

## What was done

- **Design tokens** (`docs/design-tokens.md`): colours sampled from the brochure, fonts, type styles, motifs, spacing and photo treatment. Approved.
- **Theme** (`src/app/globals.css`): new palette (cream `#F7F3E5`, forest `#283327`, olive, leaf, sage, ink…), brochure type utilities (`text-display`, `text-heading-strong/soft`, `text-quote`, `text-title`, `text-kicker`, `text-label`, `text-body`, `rule-short`, `container-page`), an organic radius, and calm reveal motion with reduced-motion support.
- **Fonts** (`src/app/layout.tsx`): Red Hat Display (body), Montserrat (labels), and Source Sans 3 as the default title font. Inter and Playfair are removed.
- **Admin**: still works. Old token names (`charcoal`, `forest`, …) point at the new values, and `font-serif` became `font-display`.
- **Shared button** (`src/components/ui/button.tsx`): new `brand`, `brand-light`, `brand-outline` variants and an `lg` size. Admin variants are unchanged.
- **Site components** (`src/components/site/`), reusable in Phase 5: header (transparent → cream on scroll, accessible mobile menu), footer, section heading pair, kicker, icon row, wave, sage blob, leaf sprig, photo, pillar list, reveal, placeholder badge, icons.
- **Static homepage preview** at **`/preview`** (noindex), in this order: hero → intro band → Stay/Dine/Explore/Celebrate → layered-photo about → rooms teaser → activities (expandable) → weddings & events + conferences → location → font comparison (dev only) → footer.
- **Content**: every preview string lives in one module, `src/app/preview/content.ts`, sourced from the brochure, design.md or your answers. Business details there are for the preview only; Phase 5 moves them to the database.
- **Title-font comparison**: a floating switcher applies Source Sans 3 / Fira Sans / Alegreya Sans to the whole page, and a side-by-side specimen section sits at `#font-compare`.

## How to run it

```sh
npm run preview:photos   # copies docs/photos → public/preview (gitignored, macOS sips)
npm run dev              # then open http://localhost:3000/preview
```

The preview photos aren't committed (`docs/photos/` and `public/preview/` are gitignored), so on another machine or on Netlify `/preview` will show empty photo frames. The logos are committed under `public/` (`logo.png`, `logo-mark.png`), as AGENTS.md allows.

## Checked

- `npm run typecheck`, `npm run lint` and `npm run build` all pass.
- Desktop 1440×900 and phone 390×844: no horizontal page overflow and no console errors.
- Mobile menu opens and closes (including Esc), activity panels expand, and the font switcher changes the title font.
- Admin login page still renders correctly with the new tokens.
- Screenshots are in `docs/screenshots/phase-1.5/` (gitignored because they include the resort photos).

## What to test

1. Open `/preview` on desktop and phone, and try all three title fonts.
2. Hover and focus Stay / Dine / Explore / Celebrate on desktop; the photo should cross-fade.
3. Tab through the page and check the focus rings.
4. Turn on "reduce motion" in the OS and check that the fade-ups stop.

## Placeholders (all show a visible DEV PLACEHOLDER badge)

- Room types, counts, amenities and rates
- Village Walks, Birdwatching, Pickleball and Outdoor Relaxation details
- Wedding photo: a mockup, not a real event
- Nepalgunj and Krishnasaar distances (brochure list and map disagree)
- "Get Directions" link (currently the brochure QR short link `qr.codes/3pb4MX`)

## Notes

- "Book Your Stay" buttons point to the footer contact details until the booking flow exists (Phase 3).
- Nav "Dine" goes to the pillars section, because the homepage outline you gave had no separate dining section.
- Conferences & Trainings sits inside the events section, using the real conference-room photo.
- `restaurant.jpg` is actually a HEIC file; the preview script converts it to JPEG. It isn't used on the homepage yet.
- `night-farmhouse.jpg` isn't used: it's very dark and rotated via EXIF.
- Photos are reused across sections in places (for example, `room.jpg` in Stay and the rooms teaser) because only a limited set of photos is available.
- Added dependency: `lucide-react` (ISC) for line icons. Instagram, WhatsApp, rings and bridge icons are small inline SVGs.

## Open questions

1. Title font: Source Sans 3 (recommended), Fira Sans or Alegreya Sans?
2. Nepalgunj: ~41 km or ~40 km? Krishnasaar: 10 mins or 10–15 min?
3. A direct Google Maps link for the resort.
