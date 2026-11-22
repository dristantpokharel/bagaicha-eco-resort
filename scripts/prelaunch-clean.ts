import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

/** Usage: npm run db:prelaunch-clean -- --expect-host=<live-db-host> [--apply]. */

export const DELETE_ORDER = [
  "room_tasks",
  "booking_extras",
  "stock_movements",
  "invoices",
  "room_blocks",
  "bookings",
  "reservations",
  "enquiries",
  "guests",
  "activity_logs",
  "rate_limits",
] as const;

export const COUNT_TABLES = [...DELETE_ORDER, "rooms", "stock_balances", "inventory_items"] as const;

export const RESET_TABLES = ["rooms", "stock_balances", "inventory_items"] as const;

export const RESET_SEQUENCE_STATEMENTS = [
  'ALTER SEQUENCE "booking_number_seq" RESTART WITH 1',
  'ALTER SEQUENCE "invoice_number_seq" RESTART WITH 1',
] as const;

const TABLE_SQL = {
  room_tasks: '"room_tasks"',
  booking_extras: '"booking_extras"',
  stock_movements: '"stock_movements"',
  invoices: '"invoices"',
  room_blocks: '"room_blocks"',
  bookings: '"bookings"',
  reservations: '"reservations"',
  enquiries: '"enquiries"',
  guests: '"guests"',
  activity_logs: '"activity_logs"',
  rate_limits: '"rate_limits"',
  rooms: '"rooms"',
  stock_balances: '"stock_balances"',
  inventory_items: '"inventory_items"',
} satisfies Record<(typeof COUNT_TABLES)[number], string>;

export type CleanOptions = { apply: boolean; expectHost?: string };

export function parseOptions(args: readonly string[]): CleanOptions {
  let apply = false;
  let expectHost: string | undefined;
  for (const arg of args) {
    if (arg === "--apply") {
      if (apply) throw new Error("--apply may only be specified once.");
      apply = true;
    } else if (arg.startsWith("--expect-host=")) {
      if (expectHost !== undefined) throw new Error("--expect-host may only be specified once.");
      expectHost = arg.slice("--expect-host=".length).trim();
      if (!expectHost) throw new Error("--expect-host=<host> is required.");
    } else {
      throw new Error("Unknown option. Use --expect-host=<host> and optionally --apply.");
    }
  }
  return { apply, expectHost };
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "").replace(/^\[(.*)\]$/, "$1");
}

function urlHost(value: string, name: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL.`);
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`${name} must use PostgreSQL.`);
  }
  if (!parsed.hostname) throw new Error(`${name} must include a host.`);
  return normalizeHost(parsed.hostname);
}

export function assertSafeHost(config: {
  liveUrl?: string;
  databaseUrl?: string;
  directUrl?: string;
  expectHost?: string;
}): string {
  if (!config.liveUrl?.trim()) throw new Error("DIRECT_URL_LIVE is required.");
  if (!config.expectHost?.trim()) throw new Error("--expect-host=<host> is required.");

  const liveHost = urlHost(config.liveUrl, "DIRECT_URL_LIVE");
  for (const [name, value] of [
    ["DATABASE_URL", config.databaseUrl],
    ["DIRECT_URL", config.directUrl],
  ] as const) {
    if (value?.trim() && urlHost(value, name) === liveHost) {
      throw new Error(`DIRECT_URL_LIVE uses the same host as ${name}; refusing to continue.`);
    }
  }

  const expectedHost = normalizeHost(config.expectHost);
  if (expectedHost !== liveHost) throw new Error("--expect-host does not match the DIRECT_URL_LIVE host.");
  return liveHost;
}

export function maskHost(host: string): string {
  const labels = host.split(".");
  return labels.length >= 3 ? `***.${labels.slice(-2).join(".")}` : "***";
}

export const shouldRollback = (options: Pick<CleanOptions, "apply">): boolean => !options.apply;

type QueryClient = Pick<PrismaClient, "$queryRawUnsafe" | "$executeRawUnsafe">;

async function rowCount(client: QueryClient, table: (typeof COUNT_TABLES)[number]): Promise<number> {
  const result = await client.$queryRawUnsafe<{ count: bigint | number }[]>(`SELECT count(*)::bigint AS count FROM ${TABLE_SQL[table]}`);
  return Number(result[0]?.count ?? 0);
}

async function tableCounts(client: QueryClient): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of COUNT_TABLES) counts[table] = await rowCount(client, table);
  return counts;
}

async function nonzeroResetCounts(client: QueryClient): Promise<Record<string, number>> {
  const rows = await client.$queryRawUnsafe<{ rooms: bigint | number; stock_balances: bigint | number; inventory_items: bigint | number }[]>(
    `SELECT
      (SELECT count(*) FROM "rooms" WHERE "status" <> 'READY' OR "dirtyCycle" <> 0 OR "statusNote" IS NOT NULL OR "inspectBookingId" IS NOT NULL) AS rooms,
      (SELECT count(*) FROM "stock_balances" WHERE "quantity" <> 0) AS stock_balances,
      (SELECT count(*) FROM "inventory_items" WHERE "quantity" <> 0) AS inventory_items`,
  );
  return Object.fromEntries(Object.entries(rows[0] ?? {}).map(([key, value]) => [key, Number(value)]));
}

async function assertResetSequencesExist(client: QueryClient): Promise<void> {
  const rows = await client.$queryRawUnsafe<{ booking: string | null; invoice: string | null }[]>(
    `SELECT to_regclass('"booking_number_seq"')::text AS booking, to_regclass('"invoice_number_seq"')::text AS invoice`,
  );
  if (!rows[0]?.booking || !rows[0]?.invoice) throw new Error("Required booking or invoice sequence is missing; no data was changed.");
}

async function assertInvoiceDeleteGuard(client: QueryClient): Promise<void> {
  const rows = await client.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgrelid = '"invoices"'::regclass
        AND tgname = 'invoices_no_delete_trigger'
        AND NOT tgisinternal
    ) AS exists`,
  );
  if (!rows[0]?.exists) throw new Error("The expected invoice delete-protection trigger is missing; no data was changed.");
}

function printSummary(label: string, counts: Record<string, number>): void {
  console.log(label);
  for (const table of COUNT_TABLES) console.log(`  ${table}: ${counts[table] ?? 0}`);
}

class DryRunRollback extends Error {}

async function clean(client: PrismaClient, apply: boolean, host: string): Promise<void> {
  await client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '110s'");

    // Block concurrent writes while the cleanup and sequence resets are in progress.
    const lockTables = [...new Set([...DELETE_ORDER, ...RESET_TABLES])].map((table) => TABLE_SQL[table as (typeof COUNT_TABLES)[number]]).join(", ");
    await tx.$executeRawUnsafe(`LOCK TABLE ${lockTables} IN SHARE ROW EXCLUSIVE MODE`);

    await assertResetSequencesExist(tx);
    await assertInvoiceDeleteGuard(tx);
    const before = await tableCounts(tx);
    const resetRows = await nonzeroResetCounts(tx);

    console.log(`Connected host: ${maskHost(host)}`);
    console.log(apply ? "Mode: APPLY" : "Mode: DRY RUN (all changes will roll back)");
    printSummary("Before (rows per affected table):", before);
    console.log("Planned deletes in dependency order:");
    for (const table of DELETE_ORDER) console.log(`  ${table}: ${before[table]}`);
    console.log("  stock_movements includes transfers and LOST/DAMAGED write-offs; all movement history will be removed.");
    console.log("Planned resets:");
    console.log(`  rooms to set READY and clear cycle/status references: ${resetRows.rooms ?? 0}`);
    console.log(`  nonzero stock balances to set to zero: ${resetRows.stock_balances ?? 0}`);
    console.log(`  inventory item quantities to set to zero: ${resetRows.inventory_items ?? 0}`);
    console.log("  booking_number_seq and invoice_number_seq will restart at 1");
    console.log("Invoice protection: invoices_no_delete_trigger is suspended only around invoice deletion, under this transaction's table lock, then immediately re-enabled. Any error rolls back and restores it.");

    for (const table of DELETE_ORDER) {
      if (table === "invoices") await tx.$executeRawUnsafe('ALTER TABLE "invoices" DISABLE TRIGGER "invoices_no_delete_trigger"');
      await tx.$executeRawUnsafe(`DELETE FROM ${TABLE_SQL[table]}`);
      if (table === "invoices") await tx.$executeRawUnsafe('ALTER TABLE "invoices" ENABLE TRIGGER "invoices_no_delete_trigger"');
    }

    const now = new Date();
    await tx.room.updateMany({
      where: {
        OR: [
          { status: { not: "READY" } },
          { dirtyCycle: { not: 0 } },
          { statusNote: { not: null } },
          { inspectBookingId: { not: null } },
        ],
      },
      data: { status: "READY", statusNote: null, dirtyCycle: 0, inspectBookingId: null, statusChangedAt: now },
    });
    await tx.stockBalance.updateMany({ where: { quantity: { not: 0 } }, data: { quantity: 0, updatedAt: now } });
    await tx.inventoryItem.updateMany({ where: { quantity: { not: 0 } }, data: { quantity: 0 } });
    for (const statement of RESET_SEQUENCE_STATEMENTS) await tx.$executeRawUnsafe(statement);

    const after = await tableCounts(tx);
    printSummary(apply ? "After (rows per affected table):" : "After planned changes inside transaction (will roll back):", after);

    if (shouldRollback({ apply })) throw new DryRunRollback("Dry run rollback requested.");
  }, { maxWait: 10_000, timeout: 120_000 });
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const liveUrl = process.env.DIRECT_URL_LIVE;
  // These two values are inspected only for endpoint comparison; neither is ever used to connect.
  const host = assertSafeHost({
    liveUrl,
    databaseUrl: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
    expectHost: options.expectHost,
  });
  if (!liveUrl) throw new Error("DIRECT_URL_LIVE is required.");

  const client = new PrismaClient({ adapter: new PrismaNeon({ connectionString: liveUrl }) });
  try {
    await clean(client, options.apply, host);
    console.log("Prelaunch cleanup committed.");
  } catch (error) {
    if (error instanceof DryRunRollback) {
      console.log("Dry run complete; the transaction was rolled back. No data was changed.");
    } else {
      const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "unknown";
      console.error(`Prelaunch cleanup failed and the transaction rolled back (error code: ${code}).`);
      process.exitCode = 1;
    }
  } finally {
    await client.$disconnect();
  }
}

const scriptUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === scriptUrl) void main();
