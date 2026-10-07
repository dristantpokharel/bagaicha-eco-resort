/**
 * The public submit action end to end (parsing, rules, prices, all-or-nothing save) against the throwaway Neon
 * branch in `.env.migration-test`. Cloudflare, rate limiting, headers and email are replaced, so nothing leaves the
 * machine except the database calls. Opt in with `npm run test:db:reservations`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadMigrationTestEnv } from "@/test/migration-test-env";

vi.mock("@/lib/auth/session", () => ({ AuthorizationError: class extends Error {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: async () => ({ ok: true }), turnstileErrorMessage: () => "security check" }));
vi.mock("@/lib/rate-limit", () => ({
  clientIpFromHeaders: () => "203.0.113.9",
  hitRateLimit: async () => ({ allowed: true }),
  rateLimitMessage: () => "slow down",
}));
const notify = vi.fn<(kind: string, id: string) => Promise<{ guest: "sent"; resort: "sent" }>>(async () => ({ guest: "sent", resort: "sent" }));
vi.mock("@/lib/email/booking-emails", () => ({ notifyReservation: (kind: string, id: string) => notify(kind, id) }));

const env = loadMigrationTestEnv();

describe.skipIf(!env)("submitBookingRequest", { timeout: 120_000 }, () => {
  const tag = `zz-sub-${Date.now().toString(36)}`;
  let db: typeof import("@/lib/db").db;
  let submit: typeof import("@/app/(site)/book/actions").submitBookingRequest;
  let dates: { checkIn: string; checkOut: string };
  let deluxe: { id: string };
  let family: { id: string };

  const iso = (offsetDays: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  };
  const form = (who: string, rooms: unknown, party = { adults: 7, children: 2 }, extra: Record<string, string> = {}) => {
    const f = new FormData();
    const fields: Record<string, string> = {
      ...dates,
      adults: String(party.adults),
      children: String(party.children),
      rooms: typeof rooms === "string" ? rooms : JSON.stringify(rooms),
      name: `${tag} ${who}`,
      email: `${tag}-${who}@example.test`,
      phone: "9800000000",
      turnstileToken: "ok",
      ...extra,
    };
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };
  const saved = (who: string) => db.reservation.count({ where: { guest: { email: `${tag}-${who}@example.test` } } });

  beforeAll(async () => {
    process.env.DATABASE_URL = env!.databaseUrl;
    process.env.DIRECT_URL = env!.directUrl;
    ({ db } = await import("@/lib/db"));
    ({ submitBookingRequest: submit } = await import("@/app/(site)/book/actions"));
    dates = { checkIn: iso(200), checkOut: iso(203) };
    deluxe = await db.roomType.create({ data: { slug: `${tag}-deluxe`, name: `${tag} Deluxe`, description: "t", basePriceNpr: 3000, childPricePerNightNpr: 500, maxGuests: 3, maxAdults: 2, sortOrder: 9201 } });
    family = await db.roomType.create({ data: { slug: `${tag}-family`, name: `${tag} Family`, description: "t", basePriceNpr: 4500, childPricePerNightNpr: 500, maxGuests: 6, maxAdults: 6, sortOrder: 9202 } });
    for (const n of ["d1", "d2", "d3", "d4", "d5"]) await db.room.create({ data: { roomTypeId: deluxe.id, name: `${tag}-${n}` } });
    await db.room.create({ data: { roomTypeId: family.id, name: `${tag}-f1` } });
  });

  afterAll(async () => {
    if (!db) return;
    const mine = { guest: { email: { startsWith: tag } } };
    await db.activityLog.deleteMany({ where: { entityType: "Reservation", entityId: { in: (await db.reservation.findMany({ where: mine, select: { id: true } })).map((r) => r.id) } } });
    await db.booking.deleteMany({ where: { reservation: mine } });
    await db.reservation.deleteMany({ where: mine });
    await db.guest.deleteMany({ where: { email: { startsWith: tag } } });
    await db.room.deleteMany({ where: { name: { startsWith: tag } } });
    await db.roomType.deleteMany({ where: { slug: { startsWith: tag } } });
    await db.$disconnect();
  });

  it("saves one reservation for 2 Deluxe + 1 Family with prices from the database, and emails once", async () => {
    notify.mockClear();
    const rooms = [
      // A tampered price in the browser payload is ignored.
      { roomTypeId: deluxe.id, adults: 2, children: 1, totalPriceNpr: 1, pricePerNightNpr: 1 },
      { roomTypeId: deluxe.id, adults: 2, children: 0 },
      { roomTypeId: family.id, adults: 3, children: 1 },
    ];
    const result = await submit(null, form("ok", rooms, { adults: 7, children: 2 }));
    expect(result).toMatchObject({ ok: true, confirmationEmail: "sent" });
    if (!result?.ok) return;
    expect(result.reference).toMatch(/^BG-\d{4}-\d{6}$/);
    expect(result.rooms).toHaveLength(3);
    // 3 nights: Deluxe 9000 + 1 child 1500, Deluxe 9000, Family 13500 + 1 child 1500.
    expect(result.rooms.map((r) => r.totalPriceNpr)).toEqual([10500, 9000, 15000]);
    expect(result.totalPriceNpr).toBe(34500);

    const row = await db.reservation.findFirstOrThrow({ where: { reference: result.reference }, include: { bookings: true } });
    expect(row.totalPriceNpr).toBe(34500);
    expect(row.bookings.map((b) => b.status)).toEqual(["PENDING", "PENDING", "PENDING"]);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("received", row.id);
  });

  it("refuses a fifth room online and saves nothing", async () => {
    const five = Array.from({ length: 5 }, () => ({ roomTypeId: deluxe.id, adults: 1, children: 0 }));
    const result = await submit(null, form("five", five, { adults: 5, children: 0 }));
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/up to 4 rooms/) });
    expect(await saved("five")).toBe(0);
  });

  it("refuses a split that doesn't add up to the group or doesn't fit a room", async () => {
    const short = await submit(null, form("short", [{ roomTypeId: deluxe.id, adults: 2, children: 0 }], { adults: 3, children: 0 }));
    expect(short).toMatchObject({ ok: false, error: expect.stringMatching(/not placed/) });
    const tooMany = await submit(null, form("big", [{ roomTypeId: deluxe.id, adults: 3, children: 0 }], { adults: 3, children: 0 }));
    expect(tooMany).toMatchObject({ ok: false, error: expect.stringMatching(/up to 2 adults/) });
    expect(await saved("short")).toBe(0);
    expect(await saved("big")).toBe(0);
  });

  it("refuses unknown room types, broken room lists and the honeypot", async () => {
    expect(await submit(null, form("unk", [{ roomTypeId: "nope", adults: 1, children: 0 }], { adults: 1, children: 0 }))).toMatchObject({ ok: false });
    expect(await submit(null, form("junk", "not json", { adults: 1, children: 0 }))).toMatchObject({ ok: false });
    expect(await submit(null, form("bot", [{ roomTypeId: deluxe.id, adults: 1, children: 0 }], { adults: 1, children: 0 }, { website: "http://spam" }))).toMatchObject({ ok: false });
    for (const who of ["unk", "junk", "bot"]) expect(await saved(who)).toBe(0);
  });

  it("is all or nothing when a room type has too few rooms free: nothing is saved", async () => {
    // Only 1 Family exists; two Family lines cannot both be free.
    const result = await submit(
      null,
      form("short-family", [{ roomTypeId: family.id, adults: 3, children: 0 }, { roomTypeId: family.id, adults: 3, children: 0 }], { adults: 6, children: 0 }),
    );
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/only 1 .* room is still free/) });
    expect(await saved("short-family")).toBe(0);
    expect(await db.guest.count({ where: { email: `${tag}-short-family@example.test` } })).toBe(0);
  });
});
