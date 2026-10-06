/**
 * Read-only check: every reusable item's total must equal the sum of its location balances.
 * Run after backfills or imports: `npm run inventory:check`. Exits 1 on any mismatch.
 */
import { config as loadEnv } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: ".env.local", quiet: true });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
  try {
    const [reusable] = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM inventory_items WHERE NOT "isConsumable"`;
    const bad = await db.$queryRaw<{ name: string; total: string; balances: string }[]>`
      SELECT i.name, i.quantity::text AS total, COALESCE(sum(b.quantity), 0)::text AS balances
      FROM inventory_items i LEFT JOIN stock_balances b ON b."itemId" = i.id
      WHERE NOT i."isConsumable"
      GROUP BY i.id HAVING i.quantity <> COALESCE(sum(b.quantity), 0)`;
    const consumablesWithBalances = await db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM stock_balances b JOIN inventory_items i ON i.id = b."itemId" WHERE i."isConsumable"`;
    console.log(`Checked ${reusable.n} reusable item(s).`);
    for (const row of bad) console.log(`  MISMATCH ${row.name}: total ${row.total}, balances ${row.balances}`);
    if (Number(consumablesWithBalances[0].n) > 0) console.log(`  ${consumablesWithBalances[0].n} balance row(s) belong to consumable items`);
    if (bad.length || Number(consumablesWithBalances[0].n) > 0) process.exitCode = 1;
    else console.log("OK: every total equals the sum of its balances.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
