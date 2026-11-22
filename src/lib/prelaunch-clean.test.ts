import { describe, expect, it } from "vitest";
import {
  assertSafeHost,
  DELETE_ORDER,
  parseOptions,
  shouldRollback,
} from "../../scripts/prelaunch-clean";

const liveUrl = "postgresql://live-user:secret@live-prod.neon.tech/resort";

describe("prelaunch cleanup safety", () => {
  it("requires an expected host and rejects the dev or staging host", () => {
    expect(() => assertSafeHost({ liveUrl, expectHost: undefined })).toThrow("--expect-host=<host> is required");
    expect(() => assertSafeHost({
      liveUrl,
      expectHost: "live-prod.neon.tech",
      databaseUrl: "postgresql://user:secret@live-prod.neon.tech/db",
    })).toThrow("same host as DATABASE_URL");
    expect(() => assertSafeHost({
      liveUrl,
      expectHost: "live-prod.neon.tech",
      directUrl: "postgresql://user:secret@live-prod.neon.tech/db",
    })).toThrow("same host as DIRECT_URL");
  });

  it("only accepts an exact expected endpoint host", () => {
    expect(assertSafeHost({ liveUrl, expectHost: "LIVE-PROD.NEON.TECH." })).toBe("live-prod.neon.tech");
    expect(() => assertSafeHost({ liveUrl, expectHost: "other-prod.neon.tech" })).toThrow("does not match");
  });

  it("defaults to dry run and enables changes only with --apply", () => {
    const dryRun = parseOptions(["--expect-host=live-prod.neon.tech"]);
    const apply = parseOptions(["--expect-host=live-prod.neon.tech", "--apply"]);
    expect(dryRun).toEqual({ apply: false, expectHost: "live-prod.neon.tech" });
    expect(shouldRollback(dryRun)).toBe(true);
    expect(apply).toEqual({ apply: true, expectHost: "live-prod.neon.tech" });
    expect(shouldRollback(apply)).toBe(false);
  });

  it("deletes child/history rows before their referenced parents", () => {
    const before = (table: (typeof DELETE_ORDER)[number], parent: (typeof DELETE_ORDER)[number]) =>
      expect(DELETE_ORDER.indexOf(table)).toBeLessThan(DELETE_ORDER.indexOf(parent));
    before("room_tasks", "bookings");
    before("booking_extras", "bookings");
    before("stock_movements", "bookings");
    before("invoices", "reservations");
    before("bookings", "reservations");
    before("reservations", "guests");
  });
});
