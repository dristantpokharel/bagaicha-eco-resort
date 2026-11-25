# Krishnasaar page: facts to verify

The `/krishnasaar` page starts as structure and plain guidance only. It contains **no numbers, names, dates or distances**, and every text field is flagged **verify**. Nothing here is a claim yet.

## How it goes live
- **Production:** the page returns 404 until **title**, **intro** and **what it is** are reviewed. Until then it is also missing from the homepage band, the Explore page, the footer, `sitemap.xml`, `llms.txt` and the JSON-LD.
- **Other sections** (history, wildlife, best time, getting there, what to bring) and each FAQ stay hidden in production until you edit them or tick **I have reviewed this** in the admin.
- **Dev and staging:** everything shows with a **Verify** badge.
- **Where to edit:** Admin → Content → Krishnasaar.
- **Seed (after the migration is applied):** `npm run seed:krishnasaar` (dry run), then `npm run seed:krishnasaar -- --apply`.

## Facts you must confirm
Mark each one off as you replace the starter text with checked wording.

### Identity and "what it is"
- [ ] The correct English and Nepali names, and the spelling to use on the page.
- [ ] What the Krishnasaar is, in plain words, and how to recognise it (appearance, behaviour).
- [ ] Whether it is protected, and by what status or law (if you want to say so).
- [ ] Population or sighting figures, if you want to quote any, with the year and the source.

### History and conservation
- [ ] The area it lives in: its name, its size, and any official status.
- [ ] The year the area was set up or protected, and by whom.
- [ ] Who manages it today (the organisation or community).
- [ ] The conservation story: any dated events, milestones or projects.
- [ ] How visitors can help, and any rules visitors must follow.

### Wildlife and best season
- [ ] Other wildlife that can be seen there, and any claims about rarity.
- [ ] The months or seasons when sightings are best, and why.
- [ ] Times of day that are best.
- [ ] Anything about sightings that must not be promised.

### Best time to visit
- [ ] Each season: weather, access and what it is like for visitors.
- [ ] Any closures or restrictions (for example during the monsoon).

### Getting there
- [ ] The place chosen in Content → Nearby for the Krishnasaar, with its **distance** and **travel time** (the page shows these automatically and never from this text).
- [ ] The route, the type of transport and what the road is like.
- [ ] Whether the resort can arrange a vehicle or a guide, and whether that costs extra.
- [ ] Any permit, entry fee, opening hours or guide requirement.

### What to bring
- [ ] Any rule about clothing, footwear, cameras, drones, food, plastic or noise.

### Questions and answers
- [ ] The answers to the five starter questions (best time, how to get there, guide and permit, what to bring, children), or replace them with your own.
- [ ] Any age or safety advice for children.

### Nearby attractions
- [ ] Each place shown under "Nearby attractions" comes from Content → Nearby. Confirm each name, distance and travel time there.

### Photos
- [ ] Rights to each photo you add to the gallery or hero, and its alt text (Media → Library).
- [ ] That any stand-in photo is replaced before launch.

### Related guides
- [ ] The guides to link at the bottom (by URL slug). The starter links the draft guide "Krishnasaar blackbuck: a visitor's guide"; it will show only when that guide is published.

## Before launch
- [ ] Every item above is confirmed.
- [ ] Title, intro and "what it is" are reviewed in the admin (the page then appears in production).
- [ ] Open `/krishnasaar` on staging with placeholders hidden and read it end to end.
