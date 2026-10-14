/**
 * One-off data step for the simplified activities (no schema change).
 *
 *   npx tsx scripts/simplify-activities-data.ts            # dry run
 *   npx tsx scripts/simplify-activities-data.ts --apply    # writes to the database in DATABASE_URL
 *
 * For each activity: the new single description (`overview`) becomes the real text of the old
 * short line and overview (both when both are real, joined by a space), and the placeholder
 * flags for the retired fields are cleared. The retired columns themselves are left untouched.
 * Safe to run twice. Never prints secret values.
 */
import { config as loadEnv } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: ".env.local", quiet: true });

const apply = process.argv.includes("--apply");
const RETIRED = ["summary", "duration", "season", "bestTime", "bestFor", "highlights", "whatToExpect", "howWeHelp", "tip"];

const isReal = (text: string | null, flagged: boolean): text is string => !!text?.trim() && !flagged && !text.startsWith("Placeholder:");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
  console.log(apply ? "APPLY mode" : "DRY RUN (nothing is written; pass --apply to write)");
  try {
    for (const a of await db.activity.findMany({ orderBy: { sortOrder: "asc" } })) {
      const summary = isReal(a.summary, a.placeholderFields.includes("summary")) ? a.summary.trim() : null;
      const overview = isReal(a.overview, a.placeholderFields.includes("overview")) ? a.overview.trim() : null;
      // Combine, unless the short line is already contained in the overview (or the reverse).
      const parts = [summary, overview].filter((t): t is string => !!t);
      const merged = parts.length === 2 && parts[1].includes(parts[0]) ? parts[1] : parts.join(" ");
      const description = merged || a.overview || a.summary || null;
      const flags = a.placeholderFields.filter((f) => !RETIRED.includes(f));
      // Without any real text, the kept text is still a placeholder: keep it flagged.
      const stillPlaceholder = !merged && !!description;
      const nextFlags = stillPlaceholder ? [...new Set([...flags, "overview"])] : flags.filter((f) => f !== "overview");
      if (description === a.overview && nextFlags.join() === a.placeholderFields.join()) continue;
      console.log(`  ${apply ? "updated" : "would update"}  ${a.slug}: ${stillPlaceholder ? "placeholder description" : "real description"}`);
      if (apply) await db.activity.update({ where: { id: a.id }, data: { overview: description, placeholderFields: nextFlags } });
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
