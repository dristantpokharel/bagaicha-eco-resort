/**
 * Idempotent starter content for /krishnasaar.
 *
 *   npm run seed:krishnasaar            # dry run: lists what would be created
 *   npm run seed:krishnasaar -- --apply # writes to the database in DATABASE_URL
 *
 * Creates the page row and its questions only when they do not exist; never changes or deletes
 * anything the owner has edited. All text is flagged "verify", so the page stays hidden in
 * production until reviewed. Never prints secret values.
 */
import { config as loadEnv } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import { KRISHNASAAR_FAQS, KRISHNASAAR_FLAGGED, KRISHNASAAR_SEED } from "../src/lib/krishnasaar/seed-content";

loadEnv({ path: ".env.local", quiet: true });

const apply = process.argv.includes("--apply");

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
    if (!(await db.krishnasaarPage.findUnique({ where: { id: 1 } }))) {
      note("Krishnasaar page (all text flagged verify)");
      if (apply) {
        await db.krishnasaarPage.create({
          data: { id: 1, ...KRISHNASAAR_SEED, relatedGuides: [...KRISHNASAAR_SEED.relatedGuides], placeholderFields: [...KRISHNASAAR_FLAGGED] },
        });
      }
    } else console.log("  Krishnasaar page: already exists, left alone");

    if ((await db.krishnasaarFaq.count()) === 0) {
      for (const [i, f] of KRISHNASAAR_FAQS.entries()) {
        note(`question: ${f.question}`);
        if (apply) await db.krishnasaarFaq.create({ data: { ...f, sortOrder: i, placeholderFields: ["question", "answer"] } });
      }
    } else console.log("  Krishnasaar questions: already exist, left alone");

    console.log(`${created} row(s) ${apply ? "created" : "would be created"}.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
