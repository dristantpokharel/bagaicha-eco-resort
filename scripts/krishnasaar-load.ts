import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { logActivity } from "../src/lib/activity-log";
import {
  parseContent,
  planFaqs,
  planGallery,
  planPage,
  resolveMedia,
  summarize,
  type Decision,
} from "../src/lib/krishnasaar/content-load";
import { maskHost } from "./prelaunch-clean";

/**
 * One-off load of the owner-approved text in docs/krishnasaar-content.md into the Krishnasaar page tables.
 *
 *   npm run krishnasaar:load -- --target=staging|live --expect-host=<host> [--apply] [--overwrite]
 *
 * Staging connects with DIRECT_URL, live with DIRECT_URL_LIVE (read through `node --env-file`, never printed).
 * Dry run by default: reads, prints a plan per field, writes nothing. --apply writes in one transaction.
 */

export type Target = "staging" | "live";
export type LoadOptions = { target: Target; expectHost: string; apply: boolean; overwrite: boolean };

export function parseOptions(args: readonly string[]): LoadOptions {
  let target: Target | undefined;
  let expectHost: string | undefined;
  let apply = false;
  let overwrite = false;
  for (const arg of args) {
    if (arg.startsWith("--target=")) {
      if (target) throw new Error("--target may only be specified once.");
      const value = arg.slice("--target=".length);
      if (value !== "staging" && value !== "live") throw new Error("--target must be staging or live.");
      target = value;
    } else if (arg.startsWith("--expect-host=")) {
      if (expectHost !== undefined) throw new Error("--expect-host may only be specified once.");
      expectHost = arg.slice("--expect-host=".length).trim();
      if (!expectHost) throw new Error("--expect-host=<host> is required.");
    } else if (arg === "--apply") {
      if (apply) throw new Error("--apply may only be specified once.");
      apply = true;
    } else if (arg === "--overwrite") {
      if (overwrite) throw new Error("--overwrite may only be specified once.");
      overwrite = true;
    } else {
      throw new Error("Unknown option. Use --target=staging|live --expect-host=<host> and optionally --apply, --overwrite.");
    }
  }
  if (!target) throw new Error("--target=staging or --target=live is required.");
  if (!expectHost) throw new Error("--expect-host=<host> is required.");
  return { target, expectHost, apply, overwrite };
}

const normalizeHost = (host: string) => host.trim().toLowerCase().replace(/\.$/, "").replace(/^\[(.*)\]$/, "$1");

function urlHost(value: string, name: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL.`);
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") throw new Error(`${name} must use PostgreSQL.`);
  if (!parsed.hostname) throw new Error(`${name} must include a host.`);
  return normalizeHost(parsed.hostname);
}

/**
 * Picks the target's URL, checks it matches --expect-host, and refuses if it points at the same host as
 * the other target. Returns the URL to connect with and its host. Never includes a value in an error.
 */
export function assertSafeTarget(config: {
  target: Target;
  directUrl?: string;
  liveUrl?: string;
  databaseUrl?: string;
  expectHost?: string;
}): { url: string; host: string } {
  const name = config.target === "live" ? "DIRECT_URL_LIVE" : "DIRECT_URL";
  const url = config.target === "live" ? config.liveUrl : config.directUrl;
  if (!url?.trim()) throw new Error(`${name} is required for --target=${config.target}.`);
  if (!config.expectHost?.trim()) throw new Error("--expect-host=<host> is required.");

  const host = urlHost(url, name);
  // Staging must never be the live database; live must never be the staging/dev database (pooled or direct).
  const others: [string, string | undefined][] =
    config.target === "live"
      ? [["DIRECT_URL", config.directUrl], ["DATABASE_URL", config.databaseUrl]]
      : [["DIRECT_URL_LIVE", config.liveUrl]];
  for (const [otherName, value] of others) {
    if (value?.trim() && urlHost(value, otherName) === host) {
      throw new Error(`${name} uses the same host as ${otherName}; refusing to continue.`);
    }
  }
  if (normalizeHost(config.expectHost) !== host) throw new Error(`--expect-host does not match the ${name} host.`);
  return { url, host };
}

/** Writes happen only with --apply. */
export const writesEnabled = (options: Pick<LoadOptions, "apply">) => options.apply;

const REQUIRED_TABLES = ["krishnasaar_page", "krishnasaar_faqs", "krishnasaar_media"] as const;

async function assertTablesExist(tx: Prisma.TransactionClient) {
  for (const table of REQUIRED_TABLES) {
    const rows = await tx.$queryRawUnsafe<{ found: string | null }[]>(`SELECT to_regclass('public."${table}"')::text AS found`);
    if (!rows[0]?.found) throw new Error(`The table ${table} does not exist in this database. Apply the Krishnasaar migration first.`);
  }
}

function print(label: string, decisions: readonly Decision[]) {
  console.log(label);
  for (const d of decisions) {
    const verb = d.status === "set" ? "would set" : d.status;
    console.log(`  ${d.name}: ${verb}${d.reason ? ` (${d.reason})` : ""}`);
  }
}

async function load(tx: Prisma.TransactionClient, options: LoadOptions, host: string, markdown: string) {
  const content = parseContent(markdown);
  await assertTablesExist(tx);

  const page = await tx.krishnasaarPage.findUnique({ where: { id: 1 } });
  if (!page) throw new Error("There is no Krishnasaar page row in this database. Run `npm run seed:krishnasaar -- --apply` first.");

  const destinations = await tx.nearbyDestination.findMany({ where: { name: content.destinationName }, select: { id: true } });
  if (destinations.length === 0) throw new Error(`No nearby destination named "${content.destinationName}" exists in this database. Add it in Content → Nearby, then run this again.`);
  if (destinations.length > 1) throw new Error(`More than one nearby destination is named "${content.destinationName}". Remove the duplicate, then run this again.`);

  const filenames = [content.heroFilename, ...content.galleryFilenames];
  const library = await tx.media.findMany({
    where: { originalFilename: { in: filenames } },
    select: { id: true, originalFilename: true },
  });
  const media = resolveMedia(filenames, library);
  const heroId = media.found.get(content.heroFilename) ?? null;
  const heroMissing = media.problems.find((p) => p.filename === content.heroFilename)?.reason;

  const pagePlan = planPage(page, content, { destinationId: destinations[0].id, heroId, heroMissing }, options.overwrite);
  const faqRows = await tx.krishnasaarFaq.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const faqPlan = planFaqs(content.faqs, faqRows, options.overwrite);
  const existing = await tx.krishnasaarMedia.findMany({ orderBy: { sortOrder: "asc" }, select: { mediaId: true, sortOrder: true } });
  const galleryPlan = planGallery(content.galleryFilenames, media.found, existing.map((g) => g.mediaId));

  console.log(`Target: ${options.target}. Connected host: ${maskHost(host)}`);
  console.log(options.apply ? "Mode: APPLY" : "Mode: DRY RUN (nothing is written)");
  if (options.overwrite) console.log("--overwrite: fields already edited by a person will be replaced.");
  print("Page:", pagePlan.decisions);
  print("Questions:", faqPlan.decisions);
  print("Gallery:", galleryPlan.decisions);
  const totals = summarize([...pagePlan.decisions, ...faqPlan.decisions, ...galleryPlan.decisions]);
  console.log(`Summary: ${totals.set} to set, ${totals.unchanged} unchanged, ${totals.skipped} skipped.`);
  for (const p of media.problems) console.log(`  media not loaded: ${p.filename} (${p.reason})`);

  if (!writesEnabled(options)) return;

  if (Object.keys(pagePlan.data).length > 0) await tx.krishnasaarPage.update({ where: { id: 1 }, data: pagePlan.data });
  for (const w of faqPlan.writes) {
    const data = { question: w.question, answer: w.answer, placeholderFields: w.placeholderFields };
    if (w.id) await tx.krishnasaarFaq.update({ where: { id: w.id }, data });
    else await tx.krishnasaarFaq.create({ data: { ...data, sortOrder: w.index } });
  }
  let next = existing.length ? Math.max(...existing.map((g) => g.sortOrder)) + 1 : 0;
  for (const mediaId of galleryPlan.add) await tx.krishnasaarMedia.create({ data: { mediaId, sortOrder: next++ } });

  // The log records what was loaded, never the text.
  await logActivity(tx, {
    userId: null,
    action: "content.krishnasaar_loaded",
    entityType: "KrishnasaarPage",
    entityId: "1",
    details: {
      target: options.target,
      overwrite: options.overwrite,
      pageFields: pagePlan.writtenFields,
      links: ["destinationId", "coverMediaId"].filter((k) => k in pagePlan.data),
      faqRowsWritten: faqPlan.writes.length,
      galleryAdded: galleryPlan.add.length,
      skipped: totals.skipped,
    },
  });
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const { url, host } = assertSafeTarget({
    target: options.target,
    directUrl: process.env.DIRECT_URL,
    liveUrl: process.env.DIRECT_URL_LIVE,
    databaseUrl: process.env.DATABASE_URL,
    expectHost: options.expectHost,
  });
  const markdown = readFileSync(resolve("docs/krishnasaar-content.md"), "utf8");
  parseContent(markdown); // fail on a malformed file before connecting

  const client = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
  try {
    await client.$transaction((tx) => load(tx, options, host, markdown), { maxWait: 10_000, timeout: 60_000 });
    console.log(options.apply ? "Krishnasaar content loaded. Public pages refresh within the hour, or at once after any admin save." : "Dry run complete. No data was changed.");
  } catch (error) {
    const known = error instanceof Error && !("code" in error);
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";
    console.error(known ? `Krishnasaar load stopped: ${error.message}` : `Krishnasaar load failed and rolled back (error code: ${code}).`);
    process.exitCode = 1;
  } finally {
    await client.$disconnect();
  }
}

const scriptUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === scriptUrl) void main();
