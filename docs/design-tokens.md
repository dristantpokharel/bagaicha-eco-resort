# Design tokens — Bagaicha Eco Resort

Source: `docs/Brochure.pdf` (4 A4 pages: cover, Stay, Dine/Explore/Conferences, Events/Location).
Colors were sampled from the rendered PDF pages (averaged pixel patches), not estimated by eye.
Font names come from the fonts embedded in the PDF and from visual comparison where text was outlined.

Status: **approved** (Phase 1.5). Implemented in `src/app/globals.css`; title font still being chosen.

---

## 1. Colors

### Brand palette (sampled)

| Token | Hex | Where it appears in the brochure |
|---|---|---|
| `cream` | `#F7F3E5` | Page background on every interior page |
| `forest` | `#283327` | Footer wave, cover bottom band, "Rooms" overlay panel |
| `forest-deep` | `#1E3228` | Round icon badges in the "nearby" list |
| `olive` | `#5A6248` | Thin wave band sitting on top of the forest footer |
| `leaf` | `#505E3E` | Leaf sprig motifs (page corners, right edge) |
| `ink` | `#3F4430` | Body text, kicker words (RELAX / RECONNECT / BELONG) |
| `ink-heading` | `#454C31` | Display headings ("a stay closer to nature", "Local Flavours") |
| `icon` | `#2B3A2B` | Line icons and icon captions |
| `sage` | `#D9DFC5` | Text panels beside photos, events icon band, "Our Location" pill, nearby rows, organic blob behind pull quote |
| `sage-muted` | `#ACB299` | Divider strokes inside sage panels |

### Logo-only colors (not UI colors)

| Hex (≈) | Use |
|---|---|
| `#E4A854` amber, `#F0CCA8` peach | Sun in the logo emblem |
| `#3C4824`, `#606C3C` | Logo greens |

The brochure never uses amber for type, buttons or panels; it shows up only in the logo and sunset photos.
design.md says to avoid gold styling, so amber stays out of the UI.

### Contrast (WCAG 2.x)

| Pair | Ratio | AA normal text |
|---|---|---|
| `ink` on `cream` | 9.09 | pass |
| `ink-heading` on `cream` | 8.11 | pass |
| `olive` on `cream` | 5.77 | pass |
| `ink` on `sage` | 7.36 | pass |
| `forest` on `sage` | 9.61 | pass |
| `cream` on `forest` | 11.87 | pass |
| `sage` on `forest` | 9.61 | pass |
| `cream` on `olive` | 5.77 | pass |
| muted caption `#6B7058` on `cream` | 4.63 | pass (smallest allowed muted text) |

Semantic colors (`success`, `warning`, `error`) stay as they are; they're admin-only.

---

## 2. Fonts

Confirmed by the owner: **titles = Seravek, body = Red Hat Display, icon labels = Montserrat. No serif** (this overrides design.md's "serif display" wording).

| Role | Brochure font | Web font (Google Fonts) |
|---|---|---|
| Titles / display | Seravek (Light Italic → Bold Italic) | **To choose:** Seravek isn't licensed for web. Candidates below |
| Body, kickers, italic panel titles | Red Hat Display | **Red Hat Display** (exact) |
| Icon labels, nav, contact strip | Montserrat | **Montserrat** (exact) |
| Logo script "Bagaicha" | lettering in the logo artwork | none, the logo is always the image file |

### Title candidates (closest free stand-ins for Seravek)

Seravek is a humanist sans: open counters, single-storey italic `a`, plain `l`, straight-tailed `y`, and a big weight range used as light vs. bold italic pairs.

| Candidate | Why it's close | Trade-off |
|---|---|---|
| **Source Sans 3** | Closest proportions and italic letterforms (plain `l`, single-storey `a`, straight `y`); variable 200–900 with italics, so both the light and heavy brochure weights exist | A little narrower and more neutral than Seravek |
| **Fira Sans** | Humanist, warm italic, full weight range with italics | `l` has a tail and the overall feel is more technical |
| **Alegreya Sans** | The most calligraphic and warm italic, very "editorial" | Smaller x-height, so it reads less like Seravek at large sizes |

All three will be shown side by side in the preview (a dev-only switcher on the homepage, so each can be judged on real headings). The chosen one becomes `--font-display`. My pick is Source Sans 3.

All families load through `next/font/google` (self-hosted, no layout shift).

---

## 3. Type styles

Sizes are web values derived from the brochure's proportions. `clamp()` scales them between phone and desktop.

| Style | Font | Weight / style | Size | Line height | Tracking | Case | Brochure example |
|---|---|---|---|---|---|---|---|
| `display` | title font | 700 italic | clamp(2.75rem, 6vw, 5rem) | 1.05 | -0.01em | as written | hero title |
| `heading-strong` (line 1) | title font | 700 italic | clamp(2rem, 4vw, 3.25rem) | 1.1 | 0 | as written | "Local Flavours", "Weddings & Events" |
| `heading-soft` (line 2) | title font | 300 italic | same as line 1 | 1.1 | 0.01em | as written | "Rooted in Culture", "closer to nature" |
| `heading-accent` | title font | 900 italic, ~1.4× | used for one key word | 1 | 0 | lowercase | "a **stay**" |
| `title` (h3) | Red Hat Display | 400 italic | 1.25–1.5rem | 1.2 | 0.02em | UPPERCASE | "RESTAURANT", "ACTIVITIES", "CHILL POOL" |
| `kicker` | Red Hat Display | 400 | 0.875–1rem | 1.9 | 0.06em | UPPERCASE, stacked list of 3 | "RELAX / RECONNECT / BELONG" |
| `label` | Montserrat | 500 | 0.75rem | 1.4 | 0.2em | UPPERCASE | icon captions "COMFORTABLE ROOMS" |
| `nav` | Montserrat | 500 | 0.8125rem | 1 | 0.18em | UPPERCASE, `|` separators | "STAY \| DINE \| CELEBRATE \| EXPLORE" |
| `body` | Red Hat Display | 400 (500 on dark backgrounds) | 1.0625rem (17px) | 1.7 | 0.01em | sentence | intro paragraphs |
| `body-sm` | Red Hat Display | 400 | 0.9375rem | 1.6 | 0.01em | sentence | panel copy |
| `quote` | title font | 300 italic | clamp(1.75rem, 3.5vw, 2.75rem) | 1.25 | 0.01em | sentence | "Wake up to birdsong, fresh air…" |
| `contact` | Montserrat | 600 | 0.9375rem | 1.4 | 0 | as written | footer contact strip |

Heading pattern: a **two-weight pair** (bold italic line, then light italic line), followed by a short rule (see motifs). Headings use `ink-heading` and body text uses `ink`. Neither is ever pure black.

---

## 4. Motifs and decorative elements

1. **Short rule.** A horizontal line about 4.5rem wide and 1.5px thick in `ink-heading`, placed under every heading pair and every kicker list. It's the brochure's main divider.
2. **Vertical hairlines.** 1px `ink`/`icon` lines about 3.5rem tall between icon + label items (amenity rows, Weddings/Celebrations/Private Events, Meetings/Trainings/Team Retreats).
3. **Wave footer.** Two stacked organic SVG waves: a thin `olive` band riding on top of `forest`. It sits at the bottom of every page and the bottom edge of photos runs into it.
4. **Sage blob.** A large soft organic `sage` shape that bleeds off the right edge, behind a light-italic pull quote.
5. **Leaf sprigs.** Dark `leaf` foliage tucked into the top-left page corner and the right page edge, always partly cropped by the edge. On the web it becomes a small decorative SVG with `aria-hidden`, never covering text.
6. **Organic-corner overlay.** A `forest` text panel overlapping a photo corner, with one large rounded corner (top-left, about 4rem radius) and square elsewhere ("ROOMS / Quiet, comfortable…").
7. **Sage text panel + photo pair.** A square sage panel (icon, italic uppercase title, short rule, centred copy) butted directly against a photo with no gap.
8. **Pill.** A fully rounded `sage` pill holding a heading ("Our Location").
9. **Round icon badges.** `forest-deep` circles with a cream glyph, used in the nearby-destinations list.
10. **Line icons.** Simple outline icons at about 1.5px stroke in `icon` green, a few filled glyphs (bed, people). Web: one consistent line-icon set at 1.5 stroke.
11. **Logo lockup.** Circular emblem + script wordmark + "— ECO RESORT —". Always the provided image file and never re-typeset.

Not used by the brochure, and so not used on the site: drop shadows, gradients (apart from photo-legibility scrims), glass effects, gold, rounded cards.

---

## 5. Spacing and layout

| Token | Value | Rationale |
|---|---|---|
| Page gutter | 16px phone · 32px tablet · 64px desktop | brochure margin ≈ 4% of page width |
| Container max | 1280px (text columns max ~36rem / 60ch) | brochure body column ≈ 45% of page |
| Photo gutter | 12px phone · 16px desktop | brochure photo gaps are tight, ≈ 1.4% of width |
| Section spacing | 4rem phone · 6rem desktop | keeps existing `--spacing-section` tokens |
| Heading → rule → body | 1.25rem · 1.5rem | brochure rhythm |
| Icon row item | icon 2.5rem, label 0.75rem below | amenity rows |

Composition traits to carry over: an asymmetric split (text column of about 40% next to a photo of about 60%), photos that bleed to the page edge, and generous empty cream space around headings.

---

## 6. Photo treatment

- **Square corners** on all photos. The only rounding is the organic overlay corner (motif 6).
- **No borders, no shadows, no filters or duotones.** Keep the warm, natural golden-hour colour the photos already have.
- **Hero + detail row.** One large photo followed by a row of 2–3 equal-height detail crops (bed, curtains, towel).
- **Edge bleed.** Landscape/property photos run off one page edge and into the wave footer.
- **Text never sits directly on busy photo areas.** It goes on a cream/sage/forest panel, or on a hero with a subtle dark scrim for contrast.
- Aspect ratios: hero 16:9 desktop / 4:5 phone; editorial 4:3; detail 4:3 or 1:1.

---

## 7. Token mapping for `globals.css`

Existing token **names** used by the admin (`cream`, `forest`, `forest-dark`, `sage`, `sage-light`, `charcoal`) are kept and repointed to the new values so the admin doesn't break. New names are added for the rest.

```
--color-cream:        #F7F3E5
--color-cream-dark:   #EDE8D6   (derived: hover/alt surface)
--color-forest:       #283327
--color-forest-dark:  #1E3228
--color-olive:        #5A6248
--color-leaf:         #505E3E
--color-ink:          #3F4430
--color-ink-heading:  #454C31
--color-ink-muted:    #6B7058   (derived, 4.63:1 on cream)
--color-icon:         #2B3A2B
--color-sage:         #D9DFC5   (was mid-green; now the brochure panel sage)
--color-sage-muted:   #ACB299
--color-charcoal → alias of ink   (admin text)
--color-earth*  → removed after checking nothing uses them
--font-display: <chosen title font> · --font-sans: Red Hat Display · --font-label: Montserrat
--radius-organic: 4rem (one corner only) · --radius-pill: 9999px
```

Admin shadows and radii stay as they are; the public site doesn't use them.

---

## 8. Brochure facts and decisions

| Topic | Decision |
|---|---|
| Tagline | "Where nature meets comfort" (design.md) |
| Intro line under the hero + default meta description | "A perfect escape in the heart of Bardiya" (brochure) |
| Main phone | +977 9747932458 |
| WhatsApp | +977 9851081502 as a WhatsApp chat button (`wa.me` link) |
| Weddings subheading and copy | design.md's version; the brochure's "or gathering together" typo isn't carried over |
| Wedding photo | `wedding-mock.png` is a mockup, shown only with a placeholder badge |
| Nearby distances | **Open.** Nepalgunj (list ~41 km vs map ~40 km) and Krishnasaar (list 10 mins vs map 10–15 min) are shown as marked placeholders until confirmed. Thakurdwara (~30 km, 50 mins) and Karnali Bridge (~53 km, 75 mins) agree in both places |
| Directions link | **Open.** The brochure QR code points to the `qr.codes/3pb4MX` short link; a direct Google Maps link is needed |

---

## 9. Open questions

1. Which title font: Source Sans 3 (recommended), Fira Sans or Alegreya Sans? Compare them on `/preview`.
2. Nepalgunj and Krishnasaar distances (section 8).
3. Direct Google Maps link for "Get Directions".
