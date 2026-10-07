/**
 * The guest-snapshot migration copies each reservation's linked guest into the new columns, and rolls back if
 * any row is left without a name. Runs only against the throwaway Neon branch in `.env.migration-test`, inside a
 * temporary Postgres schema (opt in with `npm run test:db:reservations`).
 */
import { readdirSync, readFileSync } from "node:fs";
import { Client } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadMigrationTestEnv } from "@/test/migration-test-env";

const env = loadMigrationTestEnv();
const SNAPSHOT_MIGRATION = "20261008000100_reservation_guest_snapshot";
const migrationSql = (name: string) => readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8");

describe.skipIf(!env)("reservation guest snapshot migration", { timeout: 120_000 }, () => {
  const tag = `snap_${Date.now().toString(36)}`;
  const schemas: string[] = [];
  let client: Client;

  /** Every migration before the snapshot one, then reservations that only know their guest by id. */
  async function schemaBeforeSnapshot(name: string) {
    const schema = `${tag}_${name}`;
    schemas.push(schema);
    await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}", public`);
    const before = readdirSync("prisma/migrations", { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name < SNAPSHOT_MIGRATION)
      .map((d) => d.name)
      .sort();
    for (const m of before) await client.query(migrationSql(m));
    await client.query(`
      INSERT INTO guests (id, name, email, phone, country, "updatedAt") VALUES
        ('g1', 'Sita Rai', 'sita@example.test', '9800000001', 'Nepal', now()),
        ('g2', 'Walk In', NULL, '9800000002', NULL, now());
      INSERT INTO reservations (id, reference, "guestId", "checkIn", "checkOut", source, "totalPriceNpr", "updatedAt") VALUES
        ('r1', 'BG-2026-000001', 'g1', '2027-01-10', '2027-01-12', 'WEBSITE', 6000, now()),
        ('r2', 'BG-2026-000002', 'g2', '2027-02-10', '2027-02-12', 'PHONE', 6000, now()),
        ('r3', 'BG-2026-000003', 'g1', '2027-03-10', '2027-03-12', 'WEBSITE', 6000, now());
    `);
  }

  beforeAll(async () => {
    client = new Client({ connectionString: env!.directUrl });
    await client.connect();
  });

  afterAll(async () => {
    for (const schema of schemas) await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  });

  it("fills every reservation's snapshot from its linked guest, nulls included", async () => {
    await schemaBeforeSnapshot("fill");
    await client.query(migrationSql(SNAPSHOT_MIGRATION));
    const rows = (await client.query(`SELECT id, "guestName", "guestEmail", "guestPhone", "guestCountry" FROM reservations ORDER BY id`)).rows;
    expect(rows).toEqual([
      { id: "r1", guestName: "Sita Rai", guestEmail: "sita@example.test", guestPhone: "9800000001", guestCountry: "Nepal" },
      { id: "r2", guestName: "Walk In", guestEmail: null, guestPhone: "9800000002", guestCountry: null },
      { id: "r3", guestName: "Sita Rai", guestEmail: "sita@example.test", guestPhone: "9800000001", guestCountry: "Nepal" },
    ]);
    // The link is kept, and the name is now required.
    expect((await client.query(`SELECT count(*)::int AS n FROM reservations WHERE "guestId" IS NOT NULL`)).rows[0].n).toBe(3);
    await expect(
      client.query(`INSERT INTO reservations (id, reference, "guestId", "checkIn", "checkOut", source, "totalPriceNpr", "updatedAt")
        VALUES ('r9', 'BG-2026-000009', 'g1', '2027-04-01', '2027-04-02', 'WEBSITE', 0, now())`),
    ).rejects.toThrow(/guestName/);
  });

  it("rolls back if a reservation is left without a name", async () => {
    await schemaBeforeSnapshot("guard");
    const broken = migrationSql(SNAPSHOT_MIGRATION).replace(`WHERE g."id" = r."guestId";`, `WHERE g."id" = r."guestId" AND r."id" <> 'r1';`);
    expect(broken).not.toBe(migrationSql(SNAPSHOT_MIGRATION));
    await expect(client.query(broken)).rejects.toThrow(/have no guest name/);
    const cols = (await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'reservations'`)).rows.map((c) => c.column_name);
    expect(cols).not.toContain("guestName");
  });
});
