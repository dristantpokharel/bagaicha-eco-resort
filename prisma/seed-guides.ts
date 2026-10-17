/**
 * Idempotent guide outlines seed.
 * - Creates each guide as a DRAFT only if its slug does not exist yet.
 * - Never changes or deletes an existing guide (so owner edits are safe to re-run over).
 * - Outlines only: headings and "Owner to write" markers. No facts. Text fields are flagged as
 *   placeholders, so a guide cannot be published until the owner has written and reviewed it.
 * Never prints secret values.
 */
import { config as loadEnv } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: ".env.local", quiet: true });

const TODO = "*Owner to write.*";
const outline = (headings: string[]) => headings.map((h) => `## ${h}\n\n${TODO}`).join("\n\n") + "\n";

const GUIDES: { title: string; slug: string; tags: string[]; headings: string[] }[] = [
  {
    title: "Getting to Bardiya: from Nepalgunj airport and from Kathmandu",
    slug: "getting-to-bardiya-from-nepalgunj-airport-and-from-kathmandu",
    tags: ["getting there"],
    headings: ["Overview", "From Nepalgunj airport", "From Kathmandu", "Arriving at Bagaicha", "Before you travel"],
  },
  {
    title: "The best time to visit Bardiya",
    slug: "the-best-time-to-visit-bardiya",
    tags: ["planning"],
    headings: ["Overview", "The seasons at a glance", "What each season offers", "What to pack", "Our recommendation"],
  },
  {
    title: "Krishnasaar blackbuck: a visitor's guide",
    slug: "krishnasaar-blackbuck-a-visitors-guide",
    tags: ["wildlife"],
    headings: ["About the blackbuck", "Where and when to see them", "Visiting responsibly", "Combining it with your stay"],
  },
  {
    title: "Bardiya in 2 or 3 days: suggested itineraries",
    slug: "bardiya-in-2-or-3-days-suggested-itineraries",
    tags: ["itineraries", "planning"],
    headings: ["How to use these itineraries", "Two days", "Three days", "Adding time to rest", "Booking your stay"],
  },
  {
    title: "Bardiya National Park: jeep safari or jungle walk?",
    slug: "bardiya-national-park-jeep-safari-or-jungle-walk",
    tags: ["wildlife", "itineraries"],
    headings: ["Two ways to explore", "Jeep safari", "Jungle walk", "Which suits you", "Practical notes"],
  },
  {
    title: "Tharu culture and village visits near Bardiya",
    slug: "tharu-culture-and-village-visits-near-bardiya",
    tags: ["culture"],
    headings: ["About the Tharu community", "Village visits", "Visiting respectfully", "What to expect"],
  },
  {
    title: "Birdwatching around Gulariya",
    slug: "birdwatching-around-gulariya",
    tags: ["wildlife", "birdwatching"],
    headings: ["Why birdwatch here", "Where to look", "When to go", "What to bring", "Birdwatching with us"],
  },
  {
    title: "Weddings and events in Bardiya",
    slug: "weddings-and-events-in-bardiya",
    tags: ["events"],
    headings: ["Celebrating in Bardiya", "Spaces for your event", "Guests and stays", "Planning with us", "Send an enquiry"],
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
  try {
    let created = 0;
    for (const g of GUIDES) {
      if (await db.guide.findUnique({ where: { slug: g.slug }, select: { id: true } })) {
        console.log(`exists   ${g.slug}`);
        continue;
      }
      await db.guide.create({
        data: {
          slug: g.slug,
          title: g.title,
          excerpt: "Owner to write: a one- or two-sentence summary.",
          body: outline(g.headings),
          tags: g.tags,
          status: "DRAFT",
          placeholderFields: ["excerpt", "body", "seoTitle", "seoDescription", "authorName"],
        },
      });
      created++;
      console.log(`created  ${g.slug}`);
    }
    console.log(`Done: ${created} created, ${GUIDES.length - created} already there.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.name : "unknown error");
  process.exit(1);
});
