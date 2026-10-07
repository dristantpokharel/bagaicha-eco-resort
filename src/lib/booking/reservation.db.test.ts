/**
 * Multi-room availability and creation against the throwaway Neon branch in `.env.migration-test`
 * (opt in with `npm run test:db:reservations`). Every row uses a unique tag and only those rows are removed.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadMigrationTestEnv } from "@/test/migration-test-env";

vi.mock("@/lib/auth/session", () => ({ AuthorizationError: class extends Error {} }));

const env = loadMigrationTestEnv();

describe.skipIf(!env)("reservations against the database", { timeout: 120_000 }, () => {
  const tag = `zz-test-${Date.now().toString(36)}`;
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  const stay = { checkIn: d("2031-03-10"), checkOut: d("2031-03-13") };
  let db: typeof import("@/lib/db").db;
  let create: typeof import("./service").createReservationRecord;
  let freeCounts: typeof import("./availability").findFreeCounts;
  let userId: string;
  let ActionError: typeof import("@/lib/actions").ActionError;
  let deluxe: Awaited<ReturnType<typeof makeType>>;
  let family: Awaited<ReturnType<typeof makeType>>;
  let rooms: { deluxe: string[]; family: string[] };
  const guest = (n: string) => ({ name: `${tag}-${n}`, email: `${tag}-${n}@example.test`, phone: null });

  const makeType = (slug: string, data: { basePriceNpr: number; maxGuests: number; maxAdults: number; sortOrder: number }) =>
    db.roomType.create({ data: { slug: `${tag}-${slug}`, name: `${tag} ${slug}`, description: "test", childPricePerNightNpr: 500, ...data } });
  const makeRoom = (roomTypeId: string, name: string) => db.room.create({ data: { roomTypeId, name: `${tag}-${name}` } }).then((r) => r.id);
  const types = () => new Map([deluxe, family].map((t) => [t.id, t]));
  const line = (t: { id: string }, adults: number, children = 0, roomId?: string) => ({ roomTypeId: t.id, adults, children, roomId });
  const run = (input: Partial<Parameters<typeof create>[1]> & Pick<Parameters<typeof create>[1], "lines">, who = "x") =>
    db.$transaction((tx) => create(tx, { roomTypes: types(), ...stay, guest: guest(who), source: "WEBSITE", requireAvailability: true, ...input }), {
      timeout: 15_000,
    });
  const countFor = async (who: string) => ({
    reservations: await db.reservation.count({ where: { guest: { email: guest(who).email } } }),
    guests: await db.guest.count({ where: { email: guest(who).email } }),
    lines: await db.booking.count({ where: { reservation: { guest: { email: guest(who).email } } } }),
  });
  /** Occupies a room with a confirmed one-room reservation (the way the admin does). */
  const occupy = (roomTypeId: string, roomId: string, checkIn: Date, checkOut: Date, who: string) =>
    run({ lines: [line({ id: roomTypeId }, 1, 0, roomId)], checkIn, checkOut, requireAvailability: false, source: "PHONE", maxRooms: null }, who);

  beforeAll(async () => {
    process.env.DATABASE_URL = env!.databaseUrl;
    process.env.DIRECT_URL = env!.directUrl;
    ({ db } = await import("@/lib/db"));
    ({ createReservationRecord: create } = await import("./service"));
    ({ findFreeCounts: freeCounts } = await import("./availability"));
    ({ ActionError } = await import("@/lib/actions"));
    userId = (await db.user.create({ data: { name: tag, email: `${tag}@example.test`, passwordHash: "x" } })).id;
    deluxe = await makeType("deluxe", { basePriceNpr: 3000, maxGuests: 3, maxAdults: 2, sortOrder: 9001 });
    family = await makeType("family", { basePriceNpr: 4500, maxGuests: 6, maxAdults: 6, sortOrder: 9002 });
    rooms = {
      deluxe: [await makeRoom(deluxe.id, "d1"), await makeRoom(deluxe.id, "d2"), await makeRoom(deluxe.id, "d3")],
      family: [await makeRoom(family.id, "f1")],
    };
  });

  afterAll(async () => {
    if (!db) return;
    const guests = { guest: { email: { startsWith: tag } } };
    await db.booking.deleteMany({ where: { reservation: guests } });
    await db.reservation.deleteMany({ where: guests });
    await db.roomBlock.deleteMany({ where: { room: { name: { startsWith: tag } } } });
    await db.guest.deleteMany({ where: { email: { startsWith: tag } } });
    await db.user.deleteMany({ where: { email: { startsWith: tag } } });
    await db.room.deleteMany({ where: { name: { startsWith: tag } } });
    await db.roomType.deleteMany({ where: { slug: { startsWith: tag } } });
    await db.$disconnect();
  });

  it("creates one reference for the request with a priced line per room (2 Deluxe + 1 Family)", async () => {
    const { reservation, bookings, quote } = await run({ lines: [line(deluxe, 2, 1), line(deluxe, 2), line(family, 3, 2)] }, "price");
    expect(reservation.reference).toMatch(/^BG-\d{4}-\d{6}$/);
    expect(reservation.totalPriceNpr).toBe(quote.totalPriceNpr);
    // 3 nights: Deluxe 9000 + 1 child 1500, Deluxe 9000, Family 13500 + 2 children 3000.
    expect(bookings.map((b) => b.totalPriceNpr)).toEqual([10500, 9000, 16500]);
    expect(reservation.totalPriceNpr).toBe(36000);
    expect(bookings.map((b) => b.status)).toEqual(["PENDING", "PENDING", "PENDING"]);
    expect(bookings.map((b) => [b.adults, b.children])).toEqual([[2, 1], [2, 0], [3, 2]]);
    expect(new Set(bookings.map((b) => b.reservationId))).toEqual(new Set([reservation.id]));
  });

  it("counts only rooms that are free for every night of the stay", async () => {
    // d1 is taken for the first night only, d2 for the last night only: neither can take the whole stay, d3 can.
    await occupy(deluxe.id, rooms.deluxe[0], d("2031-03-09"), d("2031-03-11"), "cont1");
    await occupy(deluxe.id, rooms.deluxe[1], d("2031-03-12"), d("2031-03-14"), "cont2");
    const counts = await freeCounts(db, stay.checkIn, stay.checkOut);
    expect(counts.find((c) => c.type.id === deluxe.id)?.free).toBe(1);
    expect(counts.find((c) => c.type.id === family.id)?.free).toBe(1);

    await expect(run({ lines: [line(deluxe, 2), line(deluxe, 2)] }, "cont3")).rejects.toThrow(/only 1 .* room is still free/);
    expect(await countFor("cont3")).toEqual({ reservations: 0, guests: 0, lines: 0 });
    // One room is fine.
    await run({ lines: [line(deluxe, 2)] }, "cont4");
    expect((await freeCounts(db, stay.checkIn, stay.checkOut)).find((c) => c.type.id === deluxe.id)?.free).toBe(1); // PENDING holds nothing
  });

  it("ignores blocked rooms and treats back-to-back stays as free", async () => {
    await db.roomBlock.create({ data: { roomId: rooms.deluxe[2], startDate: d("2031-03-12"), endDate: d("2031-03-13"), reason: "test", createdById: userId } });
    expect((await freeCounts(db, stay.checkIn, stay.checkOut)).find((c) => c.type.id === deluxe.id)).toBeUndefined();
    // The night of the 11th: d1's stay (9 to 11) has ended, d2's (12 to 14) and d3's block (12 to 13) haven't started.
    const counts = await freeCounts(db, d("2031-03-11"), d("2031-03-12"));
    expect(counts.find((c) => c.type.id === deluxe.id)?.free).toBe(3);
  });

  it("is all-or-nothing: one short room type saves nothing for the whole request", async () => {
    await occupy(family.id, rooms.family[0], stay.checkIn, stay.checkOut, "fambusy");
    await expect(run({ lines: [line(deluxe, 2), line(family, 3)] }, "atomic")).rejects.toBeInstanceOf(ActionError);
    expect(await countFor("atomic")).toEqual({ reservations: 0, guests: 0, lines: 0 });
  });

  it("refuses a room that doesn't fit its guests and a fifth room, saving nothing", async () => {
    await expect(run({ lines: [line(deluxe, 3)] }, "fit")).rejects.toThrow(/up to 2 adults/);
    const five = Array.from({ length: 5 }, () => line(deluxe, 1));
    await expect(run({ lines: five }, "five")).rejects.toThrow(/up to 4 rooms/);
    expect(await countFor("fit")).toEqual({ reservations: 0, guests: 0, lines: 0 });
    expect(await countFor("five")).toEqual({ reservations: 0, guests: 0, lines: 0 });
  });

  it("lets staff assign distinct rooms (CONFIRMED) but not the same room twice", async () => {
    const later = { checkIn: d("2031-06-01"), checkOut: d("2031-06-03") };
    const ok = await run({ lines: [line(deluxe, 2, 0, rooms.deluxe[0]), line(deluxe, 2, 0, rooms.deluxe[1]), line(deluxe, 1)], ...later, requireAvailability: false, source: "PHONE", maxRooms: null }, "staff");
    expect(ok.bookings.map((b) => b.status)).toEqual(["CONFIRMED", "CONFIRMED", "PENDING"]);
    expect(ok.bookings.map((b) => b.roomId)).toEqual([rooms.deluxe[0], rooms.deluxe[1], null]);
    await expect(
      run({ lines: [line(deluxe, 2, 0, rooms.deluxe[2]), line(deluxe, 2, 0, rooms.deluxe[2])], checkIn: d("2031-07-01"), checkOut: d("2031-07-02"), requireAvailability: false, maxRooms: null }, "twice"),
    ).rejects.toThrow(/same room/);
    expect(await countFor("twice")).toEqual({ reservations: 0, guests: 0, lines: 0 });
    // The overlap rule still blocks a clash with an existing confirmed room.
    await expect(
      run({ lines: [line(deluxe, 2, 0, rooms.deluxe[0])], ...later, requireAvailability: false, maxRooms: null }, "clash"),
    ).rejects.toThrow(/already booked/);
  });
});
