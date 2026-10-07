// Runs a command against the throwaway Neon branch used for migration and database tests, e.g.
//   node scripts/with-test-db.mjs npx prisma migrate deploy
// It reads DATABASE_URL / DIRECT_URL from the gitignored migration-test env file by parsing it in Node
// (never in the shell, which can echo the lines). It refuses to run if those URLs point at the same host as
// .env.local (the dev database), and it masks URLs and hosts in the command's output. No value is printed.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const { parse } = createRequire(root + "package.json")("dotenv");

const test = parse(readFileSync(root + ".env.migration-test"));
const dev = parse(readFileSync(root + ".env.local"));
const clean = (v) => (v ?? "").trim();
const host = (u) => new URL(clean(u)).host;

if (!test.DATABASE_URL || !test.DIRECT_URL) {
  console.error("The migration-test env file is missing DATABASE_URL or DIRECT_URL.");
  process.exit(2);
}
if (host(test.DIRECT_URL) === host(dev.DIRECT_URL) || host(test.DATABASE_URL) === host(dev.DATABASE_URL)) {
  console.error("REFUSING: the migration-test database is the same host as .env.local.");
  process.exit(2);
}

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("Usage: node scripts/with-test-db.mjs <command> [args...]");
  process.exit(2);
}

const result = spawnSync(cmd, args, {
  cwd: root,
  env: { ...process.env, DATABASE_URL: clean(test.DATABASE_URL), DIRECT_URL: clean(test.DIRECT_URL), RUN_DB_TESTS: "1" },
  encoding: "utf8",
});
const mask = (s) =>
  (s ?? "")
    .replace(/postgres(ql)?:\/\/\S+/g, "<url>")
    .replace(/ep-[a-z0-9-]+(\.[a-z0-9.-]+)?/g, "<host>");
process.stdout.write(mask(result.stdout));
process.stderr.write(mask(result.stderr));
process.exit(result.status ?? 1);
