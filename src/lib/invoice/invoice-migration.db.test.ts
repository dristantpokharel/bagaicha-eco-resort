import { readFileSync } from "node:fs";
import { Client } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt in with an isolated Postgres connection injected into the test process.
// This test never reads an env file and never points at the app's configured database by default.
const connectionString = process.env.INVOICE_TEST_DATABASE_URL;
const enabled = Boolean(connectionString);
const migration = readFileSync("prisma/migrations/20261117000000_invoices/migration.sql", "utf8");
const statements = migration.split(/;\s*\n/).map((statement) => statement.trim()).filter(Boolean);
const lineMigration = readFileSync("prisma/migrations/20261120000000_invoice_adjustment_lines/migration.sql", "utf8");
const lineStatements = lineMigration.split(/;\s*\n/).map((statement) => statement.trim()).filter(Boolean);
const standaloneMigration = readFileSync("prisma/migrations/20261121000000_standalone_invoices/migration.sql", "utf8");
const standaloneStatements = standaloneMigration.split(/;\s*\n/).map((statement) => statement.trim()).filter(Boolean);
const taxesAndRetryMigration = readFileSync("prisma/migrations/20261123000000_invoice_tax_rows_idempotency/migration.sql", "utf8");
const taxesAndRetryStatements = taxesAndRetryMigration.split(/;\s*\n/).map((statement) => statement.trim()).filter(Boolean);

describe.skipIf(!enabled)("invoice migration database protections", { timeout: 120_000 }, () => {
  const schema = `invoice_test_${Date.now().toString(36)}`;
  let client: Client;

  async function expectRejected(sql: string) {
    await client.query("BEGIN");
    await client.query(`SET LOCAL search_path TO "${schema}", public`);
    let rejected = false;
    try { await client.query(sql); } catch { rejected = true; }
    await client.query("ROLLBACK");
    expect(rejected).toBe(true);
  }

  beforeAll(async () => {
    client = new Client({ connectionString: connectionString! });
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}", public`);
    await client.query(`CREATE TABLE users (id TEXT PRIMARY KEY); CREATE TABLE reservations (id TEXT PRIMARY KEY); CREATE TABLE business_info (id INTEGER PRIMARY KEY, "placeholderFields" TEXT[] NOT NULL DEFAULT '{}')`);
    for (const statement of statements) await client.query(statement);
    await client.query(`INSERT INTO users (id) VALUES ('u1'), ('u2'); INSERT INTO reservations (id) VALUES ('r1'); INSERT INTO invoices (id, number, "reservationId", "reservationRef", "guestSnapshot", "checkIn", "checkOut", nights, "roomLines", "extraLines", "standardSubtotalNpr", "discountTotalNpr", "grandTotalNpr", "issuedById", "updatedAt") VALUES ('i1', 'INV-2026-000001', 'r1', 'BG-2026-000001', '{"name":"Guest"}', '2026-12-01', '2026-12-03', 2, '[]', '[]', 4000, 500, 3500, 'u1', now())`);
    for (const statement of lineStatements) await client.query(statement);
    for (const statement of standaloneStatements) await client.query(statement);
    for (const statement of taxesAndRetryStatements) await client.query(statement);
    await client.query(`INSERT INTO invoices (id, number, "guestSnapshot", "invoiceDate", nights, "roomLines", "extraLines", "invoiceLines", "taxLines", "submissionId", "standardSubtotalNpr", "discountTotalNpr", "subtotalNpr", "taxTotalNpr", "grandTotalNpr", "issuedById", "updatedAt") VALUES ('i3', 'INV-2026-000003', '{"name":"Standalone"}', '2026-12-01', NULL, '[]', '[]', '[{"id":"c1","type":"CHARGE","description":"Laundry","quantity":2,"unitAmountNpr":100,"amountNpr":200}]', '[{"id":"t1","label":"VAT","mode":"PERCENT","percentage":13,"baseNpr":200,"amountNpr":26}]', 'retry-token-1', 0, 0, 200, 26, 226, 'u1', now())`);
  });

  afterAll(async () => {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  });

  it("rejects snapshot edits, deletion, and invalid status transitions while permitting payment, void and reissue", async () => {
    await expectRejected(`UPDATE invoices SET "guestSnapshot" = '{"name":"Changed"}' WHERE id = 'i1'`);
    await expectRejected(`UPDATE invoices SET "grandTotalNpr" = 1 WHERE id = 'i1'`);
    await expectRejected(`UPDATE invoices SET "invoiceLines" = '[{"type":"TAX","amountNpr":13}]' WHERE id = 'i1'`);
    await expectRejected(`UPDATE invoices SET "subtotalNpr" = 1 WHERE id = 'i1'`);
    await expectRejected(`UPDATE invoices SET "reservationId" = NULL WHERE id = 'i1'`);
    await expectRejected(`UPDATE invoices SET "invoiceLines" = '[]' WHERE id = 'i3'`);
    await expectRejected(`UPDATE invoices SET "taxLines" = '[]' WHERE id = 'i3'`);
    await expectRejected(`UPDATE invoices SET "submissionId" = 'retry-token-2' WHERE id = 'i3'`);
    await expectRejected(`INSERT INTO invoices (id, number, "guestSnapshot", "roomLines", "extraLines", "invoiceLines", "taxLines", "submissionId", "standardSubtotalNpr", "discountTotalNpr", "subtotalNpr", "taxTotalNpr", "grandTotalNpr", "issuedById", "updatedAt") VALUES ('i4', 'INV-2026-000004', '{"name":"Duplicate"}', '[]', '[]', '[]', '[]', 'retry-token-1', 0, 0, 0, 0, 0, 'u1', now())`);
    await expectRejected(`DELETE FROM invoices WHERE id = 'i1'`);
    await expectRejected(`UPDATE invoices SET status = 'PAID' WHERE id = 'i1'`);
    await expectRejected(`INSERT INTO invoices (id, number, "reservationId", "reservationRef", "guestSnapshot", "checkIn", "checkOut", nights, "roomLines", "extraLines", "standardSubtotalNpr", "discountTotalNpr", "grandTotalNpr", "issuedById", "updatedAt") VALUES ('i2', 'INV-2026-000002', 'r1', 'BG-2026-000001', '{"name":"Guest"}', '2026-12-01', '2026-12-03', 2, '[]', '[]', 4000, 500, 3500, 'u1', now())`);
    await client.query(`UPDATE invoices SET status = 'PAID', "paidAt" = '2026-12-01', "paymentMethod" = 'CASH' WHERE id = 'i1'`);
    await expectRejected(`UPDATE invoices SET "linkedReservationId" = 'r1' WHERE id = 'i1'`);
    await client.query(`UPDATE invoices SET "linkedReservationId" = 'r1' WHERE id = 'i3'`);
    await expectRejected(`UPDATE invoices SET "linkedReservationId" = NULL WHERE id = 'i3'`);
    await expectRejected(`UPDATE invoices SET "paymentMethod" = 'ESEWA' WHERE id = 'i1'`);
    await client.query(`UPDATE invoices SET status = 'VOID', "voidedAt" = now(), "voidReason" = 'Correction', "voidedById" = 'u2' WHERE id = 'i1'`);
    await client.query(`INSERT INTO invoices (id, number, "reservationId", "reservationRef", "guestSnapshot", "checkIn", "checkOut", nights, "roomLines", "extraLines", "standardSubtotalNpr", "discountTotalNpr", "grandTotalNpr", "issuedById", "updatedAt") VALUES ('i2', 'INV-2026-000002', 'r1', 'BG-2026-000001', '{"name":"Guest"}', '2026-12-01', '2026-12-03', 2, '[]', '[]', 4000, 500, 3500, 'u1', now())`);
    const sequence = await client.query(`SELECT nextval('invoice_number_seq') AS value`);
    expect(Number(sequence.rows[0].value)).toBeGreaterThan(0);
  });
});
