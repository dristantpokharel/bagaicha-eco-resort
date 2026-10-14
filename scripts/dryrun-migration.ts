/**
 * Runs one migration's SQL inside a transaction on the dev database and ALWAYS rolls it back, then checks nothing
 * was left behind. Usage: npm run db:dryrun-migration -- prisma/migrations/<name>/migration.sql
 * Reads the connection from the environment (supplied by the npm script); prints no secrets.
 */
import { readFileSync } from "node:fs";
import { db } from "../src/lib/db";

class Rollback extends Error {}

const file = process.argv[2];
if (!file) throw new Error("Pass the path to a migration.sql file.");
const sql = readFileSync(file, "utf8");
const statements = sql
  .split(/;\s*\n/)
  .map((s) => s.replace(/^(\s*--.*\n)+/gm, "").trim())
  .filter(Boolean);
const tables = [...sql.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]);

async function tableCount(client: { $queryRawUnsafe: typeof db.$queryRawUnsafe }) {
  const rows = await client.$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1)`,
    tables,
  );
  return rows[0].n;
}

async function main() {
  try {
    await db.$transaction(
      async (tx) => {
        for (const statement of statements) await tx.$executeRawUnsafe(statement);
        console.log(`applied ${statements.length} statements; new tables visible inside the transaction: ${await tableCount(tx)}/${tables.length}`);
        throw new Rollback();
      },
      { timeout: 60_000 },
    );
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
  console.log(`after rollback, new tables present: ${await tableCount(db)} (should be 0)`);
  await db.$disconnect();
}

main();
