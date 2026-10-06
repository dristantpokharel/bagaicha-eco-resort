/**
 * Seeds public site content from facts already in the repo: docs/design.md,
 * docs/design-tokens.md §8 (brochure facts) and the Phase 1.5 preview copy.
 *
 *   npm run seed:content            # dry run: lists what would be created
 *   npm run seed:content -- --apply # writes to the database in DATABASE_URL
 *
 * Idempotent and never overwrites: rows that already exist are left alone (the
 * business row only has its empty fields filled). Anything the owner hasn't
 * provided is created as an obvious placeholder, flagged in `placeholderFields`
 * so the admin dashboard lists it. Never prints secret values.
 */
import { config as loadEnv } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: ".env.local", quiet: true });

const apply = process.argv.includes("--apply");
const ph = (what: string) => `Placeholder: ${what}, owner to provide.`;

const BUSINESS = {
  name: "Bagaicha Eco Resort",
  tagline: "Where nature meets comfort",
  intro: "A perfect escape in the heart of Bardiya",
  address: "Khairi, Gulariya-3, Bardiya, Nepal",
  phones: ["+977 9747932458"],
  whatsapp: "9779851081502",
  emails: ["bagaichaecoresort@gmail.com"],
  instagramUrl: "https://www.instagram.com/bagaichaecoresort/",
  googleMapsUrl: "https://maps.app.goo.gl/hK9US5mdfKxnD9Rr9",
  directionsUrl: "https://maps.app.goo.gl/8937HDumqd3MSTDA7",
  latitude: 28.229779,
  longitude: 81.332061,
};

const ACTIVITY_DETAILS = (name: string) => ({
  overview: ph(`${name} overview`),
  duration: ph(`${name} duration`),
  bestTime: ph(`best time for ${name.toLowerCase()}`),
  whatToExpect: ph(`what to expect on ${name.toLowerCase()}`),
});
const DETAIL_FLAGS = ["overview", "duration", "bestTime", "whatToExpect"];

const ACTIVITIES = [
  { slug: "village-walks", title: "Village Walks", summary: ph("Village Walks short line"), flags: ["summary", ...DETAIL_FLAGS] },
  { slug: "birdwatching", title: "Birdwatching", summary: "Discover local birdlife.", flags: DETAIL_FLAGS },
  { slug: "pickleball", title: "Pickleball", summary: ph("Pickleball short line"), flags: ["summary", ...DETAIL_FLAGS] },
  { slug: "outdoor-relaxation", title: "Outdoor Relaxation", summary: "Slow down and explore the outdoors.", flags: DETAIL_FLAGS },
  {
    slug: "chill-pool",
    title: "Chill Pool",
    summary: "Take a refreshing dip, relax in the nature and enjoy food and drinks by the pool.",
    flags: DETAIL_FLAGS,
  },
];

const EVENT_TYPES = [
  { slug: "weddings", name: "Weddings", summary: null, highlights: [] as string[] },
  { slug: "birthdays-and-celebrations", name: "Birthdays & Celebrations", summary: null, highlights: [] },
  { slug: "private-gatherings", name: "Private Gatherings", summary: null, highlights: [] },
  {
    slug: "conferences-and-trainings",
    name: "Conferences & Trainings",
    summary:
      "A comfortable space for meetings, trainings and group gatherings, designed for focused and productive sessions.",
    highlights: ["Meetings", "Trainings", "Group gatherings", "Team sessions"],
  },
];

const NEARBY = [
  { name: "Nepalgunj", distance: "~40 km", travelTime: "53 mins", icon: "plane" },
  { name: "Blackbuck / Krishnasaar Conservation Area", distance: "~5 km", travelTime: "10–15 mins", icon: "conservation" },
  { name: "Bardiya National Park / Thakurdwara", distance: "~30 km", travelTime: "50 mins", icon: "park" },
  { name: "Karnali Bridge", distance: "~53 km", travelTime: "75 mins", icon: "bridge" },
];

const FAQS = [
  { question: "What are the check-in and check-out times?", answer: ph("check-in and check-out times"), flags: ["answer"] },
  { question: "What is the cancellation policy?", answer: ph("cancellation policy"), flags: ["answer"] },
];

const POLICIES = [
  { slug: "cancellation-policy", title: "Cancellation policy", body: ph("cancellation policy"), flags: ["body"] },
  { slug: "check-in-and-check-out", title: "Check-in and check-out", body: ph("check-in and check-out times"), flags: ["body"] },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
  console.log(apply ? "APPLY mode" : "DRY RUN (nothing is written; pass --apply to write)");
  let created = 0;
  const note = (msg: string) => {
    created++;
    console.log(`  ${apply ? "created" : "would create"}  ${msg}`);
  };
  try {
    // Business info (single row; only empty fields are filled)
    const existing = await db.businessInfo.findUnique({ where: { id: 1 } });
    if (!existing) {
      note("business info");
      if (apply) await db.businessInfo.create({ data: { id: 1, ...BUSINESS } });
    } else {
      const fill: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(BUSINESS)) {
        const cur = (existing as Record<string, unknown>)[k];
        if (cur == null || cur === "" || (Array.isArray(cur) && cur.length === 0)) fill[k] = v;
      }
      if (Object.keys(fill).length) {
        note(`business info: fill empty fields (${Object.keys(fill).join(", ")})`);
        if (apply) await db.businessInfo.update({ where: { id: 1 }, data: fill });
      } else console.log("  business info: nothing to fill");
    }

    for (const [i, a] of ACTIVITIES.entries()) {
      if (await db.activity.findUnique({ where: { slug: a.slug } })) continue;
      note(`activity: ${a.title}`);
      if (apply)
        await db.activity.create({
          data: { slug: a.slug, title: a.title, summary: a.summary, ...ACTIVITY_DETAILS(a.title), sortOrder: i, placeholderFields: a.flags },
        });
    }

    for (const [i, e] of EVENT_TYPES.entries()) {
      if (await db.eventType.findUnique({ where: { slug: e.slug } })) continue;
      note(`event type: ${e.name}`);
      if (apply) await db.eventType.create({ data: { ...e, sortOrder: i } });
    }

    if (!(await db.diningSection.findFirst({ where: { title: "Restaurant" } }))) {
      note("dining section: Restaurant");
      if (apply)
        await db.diningSection.create({
          data: { title: "Restaurant", description: ph("restaurant description"), placeholderFields: ["description"] },
        });
    }

    for (const [i, n] of NEARBY.entries()) {
      if (await db.nearbyDestination.findFirst({ where: { name: n.name } })) continue;
      note(`nearby: ${n.name}`);
      if (apply) await db.nearbyDestination.create({ data: { ...n, sortOrder: i } });
    }

    for (const [i, f] of FAQS.entries()) {
      if (await db.faq.findFirst({ where: { question: f.question } })) continue;
      note(`FAQ: ${f.question}`);
      if (apply) await db.faq.create({ data: { question: f.question, answer: f.answer, placeholderFields: f.flags, sortOrder: i } });
    }

    for (const [i, p] of POLICIES.entries()) {
      if (await db.policy.findUnique({ where: { slug: p.slug } })) continue;
      note(`policy: ${p.title}`);
      if (apply) await db.policy.create({ data: { slug: p.slug, title: p.title, body: p.body, placeholderFields: p.flags, sortOrder: i } });
    }

    console.log(`${created} row(s) ${apply ? "created" : "would be created"}.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
