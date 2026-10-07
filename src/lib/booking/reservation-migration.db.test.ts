/**
 * Proves the multi-room migration keeps existing bookings. Runs only against the throwaway Neon branch in
 * `.env.migration-test` (opt in with `npm run test:db:reservations`). Each test builds the previous schema inside
 * its own temporary Postgres schema, seeds old-shape bookings, applies the new migration and compares.
 */
import { readdirSync, readFileSync } from "node:fs";
import { Client } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadMigrationTestEnv } from "@/test/migration-test-env";

const env = loadMigrationTestEnv();
const NEW_MIGRATION = "20261008000000_multi_room_reservations";
const migrationSql = (name: string) => readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8");

describe.skipIf(!env)("multi-room reservations migration", { timeout: 120_000 }, () => {
  const tag = `mig_${Date.now().toString(36)}`;
  const schemas: string[] = [];
  let client: Client;

  /** A fresh schema with every migration before the new one applied, plus old-shape bookings. */
  async function legacySchema(name: string) {
    const schema = `${tag}_${name}`;
    schemas.push(schema);
    await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}", public`);
    const before = readdirSync("prisma/migrations", { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name < NEW_MIGRATION)
      .map((d) => d.name)
      .sort();
    for (const m of before) await client.query(migrationSql(m));

    await client.query(`
      INSERT INTO users (id, name, email, "passwordHash", "updatedAt") VALUES ('u1', 'Staff', 'staff@example.test', 'x', now());
      INSERT INTO guests (id, name, "updatedAt") VALUES ('g1', 'Guest One', now()), ('g2', 'Guest Two', now());
      INSERT INTO room_types (id, slug, name, description, "basePriceNpr", "maxGuests", "maxAdults", "updatedAt")
        VALUES ('t1', 'deluxe', 'Deluxe', 'd', 3000, 3, 2, now());
      INSERT INTO rooms (id, "roomTypeId", name, "updatedAt") VALUES ('r1', 't1', '201', now()), ('r2', 't1', '202', now());
      INSERT INTO bookings (id, "bookingNumber", "guestId", "roomTypeId", "roomId", "checkIn", "checkOut", adults, children, status, source,
        "pricePerNightNpr", "childPricePerNightNpr", "totalPriceNpr", "specialRequests", "internalNotes", "createdById",
        "confirmedAt", "cancelledAt", "cancellationReason", "createdAt", "updatedAt")
      VALUES
        ('b1', 'BG-2026-000001', 'g1', 't1', NULL, '2026-12-01', '2026-12-03', 2, 0, 'PENDING', 'WEBSITE', 3000, 0, 6000, 'late arrival', NULL, NULL, NULL, NULL, NULL, '2026-10-01T04:00:00Z', now()),
        ('b2', 'BG-2026-000002', 'g2', 't1', 'r1', '2026-12-05', '2026-12-08', 2, 1, 'CONFIRMED', 'PHONE', 3000, 500, 10500, NULL, 'vip', 'u1', '2026-10-02T04:00:00Z', NULL, NULL, '2026-10-02T03:00:00Z', now()),
        ('b3', 'BG-2026-000003', 'g1', 't1', NULL, '2026-12-10', '2026-12-11', 1, 0, 'CANCELLED', 'OTHER', 3000, 0, 3000, NULL, NULL, NULL, NULL, '2026-10-03T04:00:00Z', 'Guest changed plans', '2026-10-03T03:00:00Z', now()),
        ('b4', 'BG-2026-000004', 'g2', 't1', 'r2', '2026-11-01', '2026-11-02', 1, 0, 'CHECKED_OUT', 'WALK_IN', 3000, 0, 3000, NULL, NULL, 'u1', '2026-11-01T04:00:00Z', NULL, NULL, '2026-11-01T03:00:00Z', now());
      INSERT INTO inventory_items (id, name, category, unit, "updatedAt") VALUES ('i1', 'Soap', 'Amenities', 'pcs', now());
      INSERT INTO stock_movements (id, "itemId", type, quantity, "userId", "balanceAfter", "bookingId") VALUES ('m1', 'i1', 'USED', -1, 'u1', 0, 'b2');
    `);
    const old = await client.query(`SELECT * FROM bookings ORDER BY id`);
    return { schema, old: old.rows as Record<string, unknown>[] };
  }

  beforeAll(async () => {
    client = new Client({ connectionString: env!.directUrl });
    await client.connect();
  });

  afterAll(async () => {
    // Only the temporary schemas this file created.
    for (const schema of schemas) await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  });

  it("wraps every existing booking in a one-room reservation and keeps all its data", async () => {
    const { old } = await legacySchema("keep");
    await client.query(migrationSql(NEW_MIGRATION));

    const reservations = (await client.query(`SELECT * FROM reservations ORDER BY id`)).rows;
    const lines = (await client.query(`SELECT * FROM bookings ORDER BY id`)).rows;
    expect(reservations).toHaveLength(old.length);
    expect(lines).toHaveLength(old.length);

    for (const o of old) {
      const r = reservations.find((x) => x.id === o.id)!;
      const l = lines.find((x) => x.id === o.id)!;
      // The reservation takes the booking's id and number.
      expect(r.reference).toBe(o.bookingNumber);
      expect(l.reservationId).toBe(o.id);
      for (const key of ["guestId", "checkIn", "checkOut", "source", "specialRequests", "internalNotes", "totalPriceNpr", "createdById", "createdAt"]) {
        expect(r[key], `${o.id}.${key}`).toEqual(o[key]);
      }
      // The line keeps its room, guests, price snapshot, status and timestamps.
      for (const key of [
        "roomTypeId", "roomId", "checkIn", "checkOut", "adults", "children", "status", "pricePerNightNpr",
        "childPricePerNightNpr", "totalPriceNpr", "confirmedAt", "cancelledAt", "cancellationReason",
      ]) {
        expect(l[key], `${o.id}.${key}`).toEqual(o[key]);
      }
    }

    // Moved columns are gone from the line; the stock movement still points at its booking.
    const cols = (await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'bookings'`)).rows.map((c) => c.column_name);
    for (const gone of ["bookingNumber", "guestId", "source", "specialRequests", "internalNotes", "createdById"]) expect(cols).not.toContain(gone);
    const movement = (await client.query(`SELECT m."bookingId", b.id FROM stock_movements m JOIN bookings b ON b.id = m."bookingId"`)).rows;
    expect(movement).toEqual([{ bookingId: "b2", id: "b2" }]);
  });

  it("keeps the reference sequence and the room-overlap rule working", async () => {
    await legacySchema("rules");
    await client.query(migrationSql(NEW_MIGRATION));

    const next = (await client.query(`SELECT nextval('booking_number_seq') AS n`)).rows[0].n;
    expect(Number(next)).toBeGreaterThan(0);

    // Two rooms in one reservation is now allowed...
    await client.query(`
      INSERT INTO reservations (id, reference, "guestId", "checkIn", "checkOut", source, "totalPriceNpr", "updatedAt")
        VALUES ('res-multi', 'BG-2026-000099', 'g1', '2027-01-10', '2027-01-12', 'WEBSITE', 12000, now());
      INSERT INTO bookings (id, "reservationId", "roomTypeId", "roomId", "checkIn", "checkOut", adults, status, "pricePerNightNpr", "totalPriceNpr", "confirmedAt", "updatedAt")
        VALUES ('line-a', 'res-multi', 't1', 'r1', '2027-01-10', '2027-01-12', 2, 'CONFIRMED', 3000, 6000, now(), now()),
               ('line-b', 'res-multi', 't1', 'r2', '2027-01-10', '2027-01-12', 2, 'CONFIRMED', 3000, 6000, now(), now());
    `);
    // ...but one physical room still can't be double-booked, and dates must be ordered.
    await expect(
      client.query(`INSERT INTO bookings (id, "reservationId", "roomTypeId", "roomId", "checkIn", "checkOut", adults, status, "pricePerNightNpr", "totalPriceNpr", "confirmedAt", "updatedAt")
        VALUES ('line-c', 'res-multi', 't1', 'r1', '2027-01-11', '2027-01-13', 1, 'CONFIRMED', 3000, 6000, now(), now())`),
    ).rejects.toThrow(/bookings_room_no_overlap/);
    await expect(
      client.query(`INSERT INTO reservations (id, reference, "guestId", "checkIn", "checkOut", source, "totalPriceNpr", "updatedAt")
        VALUES ('bad', 'BG-2026-000100', 'g1', '2027-02-02', '2027-02-02', 'WEBSITE', 0, now())`),
    ).rejects.toThrow(/reservations_checkout_after_checkin/);
  });

  it("rolls everything back if the copy is not intact", async () => {
    await legacySchema("guard");
    // A broken backfill that leaves one booking unlinked must stop the migration before anything is dropped.
    const broken = migrationSql(NEW_MIGRATION).replace(
      `UPDATE "bookings" SET "reservationId" = "id";`,
      `UPDATE "bookings" SET "reservationId" = "id" WHERE "id" <> 'b1';`,
    );
    expect(broken).not.toBe(migrationSql(NEW_MIGRATION));
    await expect(client.query(broken)).rejects.toThrow(/have no reservation/);

    const state = (await client.query(`SELECT to_regclass('reservations') AS r`)).rows[0];
    expect(state.r).toBeNull();
    const kept = (await client.query(`SELECT count(*)::int AS n FROM bookings WHERE "bookingNumber" IS NOT NULL`)).rows[0];
    expect(kept.n).toBe(4);
  });
});
