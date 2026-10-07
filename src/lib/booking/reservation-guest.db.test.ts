/**
 * Submitted contact details live on the reservation, the saved guest is only linked for history, and staff can
 * resolve a difference two ways. Runs against the throwaway Neon branch in `.env.migration-test`
 * (opt in with `npm run test:db:reservations`). Every row uses a unique tag and only those rows are removed.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadMigrationTestEnv } from "@/test/migration-test-env";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ AuthorizationError: class extends Error {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {}, unstable_cache: (fn: unknown) => fn }));
const actor = { id: "" };
vi.mock("@/lib/auth", () => ({ requirePermission: async () => ({ id: actor.id }) }));
vi.mock("next/navigation", () => ({ redirect: () => {} }));

const env = loadMigrationTestEnv();

describe.skipIf(!env)("reservation guest snapshot", { timeout: 180_000 }, () => {
  const tag = `zz-gst-${Date.now().toString(36)}`;
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  let db: typeof import("@/lib/db").db;
  let create: typeof import("./service").createReservationRecord;
  let svc: typeof import("./reservation-service");
  let snap: typeof import("./guest-snapshot");
  let admin: typeof import("./admin-queries");
  let actions: typeof import("@/app/admin/bookings/actions");
  let emails: typeof import("@/lib/email/booking-emails");
  let deluxe: { id: string; [k: string]: unknown };
  let month = 0;

  const types = () => new Map([[deluxe.id, deluxe]]) as unknown as Parameters<typeof create>[1]["roomTypes"];
  const when = () => {
    month++;
    const m = String(month).padStart(2, "0");
    return { checkIn: d(`2033-${m}-10`), checkOut: d(`2033-${m}-12`) };
  };
  const email = (n: string) => `${tag}-${n}@example.test`;
  const book = (guest: { name: string; email?: string | null; phone?: string | null; country?: string | null }, source: "WEBSITE" | "PHONE" = "WEBSITE") =>
    db.$transaction((tx) => create(tx, { roomTypes: types(), ...when(), lines: [{ roomTypeId: deluxe.id, adults: 2, children: 0 }], guest, source, maxRooms: null }), { timeout: 15_000 });
  const form = (data: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(data)) f.set(k, v);
    return f;
  };
  const reservation = (id: string) => db.reservation.findUniqueOrThrow({ where: { id }, include: { guest: true } });

  beforeAll(async () => {
    process.env.DATABASE_URL = env!.databaseUrl;
    process.env.DIRECT_URL = env!.directUrl;
    ({ db } = await import("@/lib/db"));
    ({ createReservationRecord: create } = await import("./service"));
    svc = await import("./reservation-service");
    snap = await import("./guest-snapshot");
    admin = await import("./admin-queries");
    actions = await import("@/app/admin/bookings/actions");
    emails = await import("@/lib/email/booking-emails");
    deluxe = await db.roomType.create({ data: { slug: `${tag}-deluxe`, name: `${tag} Deluxe`, description: "t", basePriceNpr: 3000, childPricePerNightNpr: 500, maxGuests: 3, maxAdults: 2, sortOrder: 9301 } });
    actor.id = (await db.user.create({ data: { name: `${tag} staff`, email: email("staff"), passwordHash: "x" } })).id;
  });

  afterAll(async () => {
    if (!db) return;
    const mine = await db.reservation.findMany({ where: { OR: [{ guestEmail: { startsWith: tag } }, { guest: { email: { startsWith: tag } } }] }, select: { id: true } });
    const ids = mine.map((r) => r.id);
    await db.activityLog.deleteMany({ where: { OR: [{ entityId: { in: ids } }, { userId: actor.id }] } });
    await db.booking.deleteMany({ where: { reservationId: { in: ids } } });
    await db.reservation.deleteMany({ where: { id: { in: ids } } });
    await db.guest.deleteMany({ where: { OR: [{ email: { startsWith: tag } }, { name: { startsWith: tag } }] } });
    await db.user.deleteMany({ where: { id: actor.id } });
    await db.roomType.deleteMany({ where: { slug: { startsWith: tag } } });
    await db.$disconnect();
  });

  it("stores the submitted details on the reservation, not the matched guest's", async () => {
    const first = await book({ name: `${tag} Old Name`, email: email("a"), phone: "9800000011", country: "Nepal" });
    const again = await book({ name: `${tag} New Name`, email: email("a"), phone: "9811111111", country: "India" });
    expect(again.guest.id).toBe(first.guest.id);

    const row = await reservation(again.reservation.id);
    expect(row).toMatchObject({ guestName: `${tag} New Name`, guestEmail: email("a"), guestPhone: "9811111111", guestCountry: "India", guestId: first.guest.id });
    // The saved guest is never overwritten by a public request.
    expect(row.guest).toMatchObject({ name: `${tag} Old Name`, phone: "9800000011", country: "Nepal" });
    expect(snap.snapshotDiff(snap.snapshotOf(row), row.guest)).toEqual(["name", "phone", "country"]);
  });

  it("a manual booking by staff snapshots the same way", async () => {
    const first = await book({ name: `${tag} Walk`, email: email("w"), phone: "9800000022" });
    const manual = await book({ name: `${tag} Walk-in Renamed`, email: email("w"), phone: "9800000022" }, "PHONE");
    const row = await reservation(manual.reservation.id);
    expect(row.guestId).toBe(first.guest.id);
    expect(row.guestName).toBe(`${tag} Walk-in Renamed`);
    expect(row.guest.name).toBe(`${tag} Walk`);
  });

  it("the list, search and emails use the snapshot", async () => {
    const first = await book({ name: `${tag} Saved`, email: email("l"), phone: "9800000033" });
    const second = await book({ name: `${tag} Submitted`, email: email("l"), phone: "9800000033" });
    expect(first.guest.id).toBe(second.guest.id);

    const found = await db.reservation.findMany({ where: admin.buildReservationWhere({ q: `${tag} Submitted` }), select: admin.reservationListSelect });
    expect(found.map((r) => r.guestName)).toEqual([`${tag} Submitted`]);
    expect(await db.reservation.count({ where: admin.buildReservationWhere({ q: `${tag} Saved` }) })).toBe(1);

    const data = await emails.loadReservationEmailData(second.reservation.id);
    expect(data).toMatchObject({ guestName: `${tag} Submitted`, guestEmail: email("l"), guestPhone: "9800000033" });
  });

  it("'update guest' copies the filled-in submitted fields onto the saved guest and logs it", async () => {
    const first = await book({ name: `${tag} U Old`, email: email("u"), phone: "9800000044", country: "Nepal" });
    const second = await book({ name: `${tag} U New`, email: email("u"), phone: "9822222222" });
    const result = await actions.updateGuestFromSubmitted(null, form({ reservationId: second.reservation.id, guestId: first.guest.id }));
    expect(result).toMatchObject({ ok: true });

    const row = await reservation(second.reservation.id);
    // Country was blank on the submission, so the saved country stays.
    expect(row.guest).toMatchObject({ name: `${tag} U New`, phone: "9822222222", country: "Nepal" });
    expect(snap.snapshotDiff(snap.snapshotOf(row), row.guest)).toEqual([]);
    expect(row.guestId).toBe(first.guest.id);

    const log = await db.activityLog.findFirstOrThrow({ where: { action: "reservation.guest_updated", entityId: second.reservation.id } });
    expect(log.userId).toBe(actor.id);
    expect(log.details).toMatchObject({ fields: ["name", "phone"] });
  });

  it("'link to a new guest' leaves the old guest alone, relinks, and logs it", async () => {
    const first = await book({ name: `${tag} L Old`, email: email("n"), phone: "9800000055" });
    const second = await book({ name: `${tag} L Other`, email: email("n"), phone: "9833333333", country: "India" });
    const result = await actions.linkToNewGuestAction(null, form({ reservationId: second.reservation.id, guestId: first.guest.id }));
    expect(result).toMatchObject({ ok: true });

    const row = await reservation(second.reservation.id);
    expect(row.guestId).not.toBe(first.guest.id);
    expect(row.guest).toMatchObject({ name: `${tag} L Other`, email: email("n"), phone: "9833333333", country: "India" });
    expect(snap.snapshotDiff(snap.snapshotOf(row), row.guest)).toEqual([]);
    expect(await db.guest.findUniqueOrThrow({ where: { id: first.guest.id } })).toMatchObject({ name: `${tag} L Old`, phone: "9800000055" });
    // The old guest keeps their own reservation.
    expect(await db.reservation.count({ where: { guestId: first.guest.id } })).toBe(1);

    const log = await db.activityLog.findFirstOrThrow({ where: { action: "reservation.guest_relinked", entityId: second.reservation.id } });
    expect(log.userId).toBe(actor.id);
    expect(log.details).toMatchObject({ fromGuestId: first.guest.id, toGuestId: row.guestId });
  });

  it("refuses when nothing differs or the page is stale, and changes nothing", async () => {
    const first = await book({ name: `${tag} S One`, email: email("s"), phone: "9800000066" });
    const same = await book({ name: `${tag} S One`, email: email("s"), phone: "9800000066" });
    const noDiff = await db.$transaction((tx) => svc.updateGuestFromSnapshot(tx, same.reservation.id, first.guest.id)).catch((e: Error) => e);
    expect(noDiff).toMatchObject({ message: expect.stringMatching(/already match/) });

    const differ = await book({ name: `${tag} S Two`, email: email("s"), phone: "9800000066" });
    const stale = await db.$transaction((tx) => svc.linkToNewGuest(tx, differ.reservation.id, "someone-else")).catch((e: Error) => e);
    expect(stale).toMatchObject({ message: expect.stringMatching(/just changed/) });
    expect((await reservation(differ.reservation.id)).guestId).toBe(first.guest.id);
    expect(await db.activityLog.count({ where: { entityId: differ.reservation.id, action: { startsWith: "reservation.guest_" } } })).toBe(0);
  });
});
