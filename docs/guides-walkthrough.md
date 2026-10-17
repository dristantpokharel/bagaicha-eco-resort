# Guides (blog) walkthrough

Branch `guides`. Admin at **Content → Guides** (Admin and Superuser only), public at `/guides`.

## What was done
- **Schema:** one additive migration (`guides` table, `GuideStatus` enum). No existing table changed.
- **Admin:** list, new and edit pages, plus a preview page. Markdown body with a toolbar, live preview and images from the Media library; cover picker; tags; author (free text); status; publish date; SEO title and meta description with length hints (title 30–60, description 120–160 characters, hints only); optional FAQ list (add, remove, reorder).
- **Publishing rules:** saving a draft always works. Publishing is refused until title, slug, excerpt, body, author, cover, SEO title and meta description exist and no placeholder text remains. A published guide's slug is locked.
- **Public:** `/guides` (newest first, `?tag=` filter, filtered views are `noindex`), `/guides/[slug]` (cover, author, date, reading time, tags, FAQ accordion, calls to action, related guides). Drafts, future-dated guides and (in production) guides with placeholder text return 404. One function decides this: `src/lib/guides/visibility.ts`.
- **Markdown is sanitised:** no raw HTML or scripts, no `javascript:` links; only Media library (Cloudinary) images are shown.
- **SEO and AI-readiness:** BlogPosting and (with FAQ) FAQPage JSON-LD; BreadcrumbList on all public pages; the site-wide Hotel JSON-LD now has geo, check-in/out times, price range (lowest to highest room price), amenity features, room (`HotelRoom`) entries and per-room offers, all from the database (it moved from the home page into the site layout); guides in `sitemap.xml` with `lastmod`; RSS at `/guides/rss.xml`; Open Graph and Twitter images from the cover; `robots.txt` names GPTBot, ClaudeBot, PerplexityBot and Google-Extended (all allowed, `/admin`, `/login`, `/api/` still disallowed); `/llms.txt` generated from the database.
- **Staging:** unchanged behaviour. `robots.txt` disallows everything; `sitemap.xml`, `/llms.txt` and `/guides/rss.xml` return 404.
- **Seed:** `npm run seed:guides` creates 8 draft outlines (headings plus "Owner to write"). It only creates missing guides and never edits or deletes.
- **Dependencies added:** `react-markdown`, `remark-gfm`, `rehype-sanitize`.

## What to test
1. Sign in as Admin. **Content → Guides** lists the 8 drafts, each showing placeholders. A Staff user does not see Guides and cannot open `/admin/content/guides`.
2. Open a draft, write something, add a cover from the library, insert an image, add an FAQ. Use **Preview** (opens the real post template with a draft banner).
3. Set status to Published and Save: the page lists exactly what is missing. Fill author, SEO fields, tick "I've reviewed this", save again.
4. Visit `/guides` and the post: cover, reading time, tags, related guides, the three calls to action, FAQ. View source: BlogPosting, FAQPage, BreadcrumbList.
5. Try a future publish date: the guide stays hidden until that day (Kathmandu).
6. `/guides/rss.xml`, `/sitemap.xml` (guide with lastmod), `/llms.txt`, `/robots.txt`.
7. Run a rich results / schema validator on the home page and a guide.

## Placeholders and open items for the owner
- **All 8 guides are outlines** and cannot be published until the owner writes the excerpt and body, picks a cover and author, and writes SEO text:
  1. Getting to Bardiya: from Nepalgunj airport and from Kathmandu
  2. The best time to visit Bardiya
  3. Krishnasaar blackbuck: a visitor's guide
  4. Bardiya in 2 or 3 days: suggested itineraries
  5. Bardiya National Park: jeep safari or jungle walk?
  6. Tharu culture and village visits near Bardiya
  7. Birdwatching around Gulariya
  8. Weddings and events in Bardiya
- Starting tags (`getting there`, `planning`, `wildlife`, `itineraries`, `culture`, `birdwatching`, `events`) come from the titles; change as you like.
- Page copy for `/guides` ("Guides for visiting Bardiya", "Planning notes and local know-how for your stay.") is in `src/config/site-copy.ts`: please confirm the wording.
- Room amenities are saved as free text (one entry reads "AC, TV"); JSON-LD splits on commas. Consider entering one amenity per line.
- The Hotel JSON-LD price range comes from room base prices; rooms still holding placeholder prices would show in it.
- The `/llms.txt` and RSS output list the site URL from `NEXT_PUBLIC_SITE_URL`: check it is the live domain before launch.
