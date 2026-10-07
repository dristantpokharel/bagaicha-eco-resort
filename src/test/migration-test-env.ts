import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";

/**
 * Connection strings for the throwaway Neon branch used by database tests (`.env.migration-test`, gitignored).
 * Returns null when the file is missing, so the tests skip. Refuses to return anything that points at the same
 * host as `.env.local` (the dev database). Values are never printed.
 */
export function loadMigrationTestEnv(): { databaseUrl: string; directUrl: string } | null {
  if (process.env.RUN_DB_TESTS !== "1" || !existsSync(".env.migration-test")) return null;
  const test = parse(readFileSync(".env.migration-test"));
  const databaseUrl = test.DATABASE_URL?.trim();
  const directUrl = test.DIRECT_URL?.trim();
  if (!databaseUrl || !directUrl) return null;
  if (existsSync(".env.local")) {
    const dev = parse(readFileSync(".env.local"));
    const same = (a?: string, b?: string) => Boolean(a && b) && new URL(a!.trim()).host === new URL(b!.trim()).host;
    if (same(directUrl, dev.DIRECT_URL) || same(databaseUrl, dev.DATABASE_URL)) {
      throw new Error("Refusing to run database tests: .env.migration-test points at the same host as .env.local.");
    }
  }
  return { databaseUrl, directUrl };
}
