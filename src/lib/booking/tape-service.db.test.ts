/**
 * Tape-chart moves against the throwaway Neon branch in `.env.migration-test` (opt in with
 * `npm run test:db:reservations`): move to a free / busy room, extend into a conflict, type change, checked-in
 * edge-only, undo, blocks and assign-by-drop. Every row carries a unique tag and only those rows are removed.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadMigrationTestEnv } from "@/test/migration-test-env";

vi.mock("@/lib/auth/session", () => ({ AuthorizationError: class extends Error {} }));

const env = loadMigrationTestEnv();

describe.skipIf(!env)("tape-chart moves against the database", { timeout: 180_000 }, () => {
  const tag = `zz-tape-${Date.now().toString(36)}`;
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  let db: typeof import("@/lib/db").db;
  let create: typeof import("./service").createReservationRecord;
  let svc: typeof import("./reservation-service");
  let tape: typeof import("./tape-service");
  let deluxe: Awaited<ReturnType<typeof makeType>>;
  let family: Awaited<ReturnType<typeof makeType>>;
  let rooms: { deluxe: string[]; family: string[] };
  let actor: { id: string };

  const makeType = (slug: string, data: { basePriceNpr: number; maxGuests: number; maxAdults: number; sortOrder: number }) =>
    db.roomType.create({ data: { slug: `${tag}-${slug}`, name: `${tag} ${slug}`, description: "test", childPricePerNightNpr: 500, ...data } });
  const makeRoom = (roomTypeId: string, name: string) => db.room.create({ data: { roomTypeId, name: `${tag}-${name}` } }).then((r) => r.id);
  const types = () => new Map([deluxe, family].map((t) => [t.id, t]));
  const inTx = <T,>(fn: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) => db.$transaction(fn, { timeout: 15_000 });
  /** A confirmed one-room reservation in a named room. */
  const stay = async (type: { id: string }, roomId: string, month: string, from: number, to: number, who: string, extra: { adults?: number } = {}) => {
    const r = await db.$transaction(
      (tx) =>
        create(tx, {
          roomTypes: types(),
          checkIn: d(`2032-${month}-${String(from).padStart(2, "0")}`),
          checkOut: d(`2032-${month}-${String(to).padStart(2, "0")}`),
          lines: [{ roomTypeId: type.id, adults: extra.adults ?? 2, children: 0, roomId }],
          guest: { name: `${tag}-${who}`, email: `${tag}-${who}@example.test`, phone: null },
          source: "PHONE",
          maxRooms: null,
        }),
      { timeout: 15_000 },
    );
    return { reservationId: r.reservation.id, bookingId: r.bookings[0].id };
  };
  const line = (id: string) => db.booking.findUniqueOrThrow({ where: { id } });
  const reservation = (id: string) => db.reservation.findUniqueOrThrow({ where: { id } });
  const move = (input: Parameters<typeof tape.applyMove>[2]) => inTx((tx) => tape.applyMove(tx, actor.id, input));

  beforeAll(async () => {
    process.env.DATABASE_URL = env!.databaseUrl;
    process.env.DIRECT_URL = env!.directUrl;
    ({ db } = await import("@/lib/db"));
    ({ createReservationRecord: create } = await import("./service"));
    svc = await import("./reservation-service");
    tape = await import("./tape-service");
    deluxe = await makeType("deluxe", { basePriceNpr: 3000, maxGuests: 3, maxAdults: 2, sortOrder: 9201 });
    family = await makeType("family", { basePriceNpr: 4500, maxGuests: 6, maxAdults: 6, sortOrder: 9202 });
    rooms = {
      deluxe: [await makeRoom(deluxe.id, "d1"), await makeRoom(deluxe.id, "d2"), await makeRoom(deluxe.id, "d3")],
      family: [await makeRoom(family.id, "f1")],
    };
    actor = await db.user.create({ data: { name: `${tag} actor`, email: `${tag}-actor@example.test`, passwordHash: "x", role: "ADMIN" } });
  });

  afterAll(async () => {
    if (!db) return;
    const mine = { guest: { email: { startsWith: tag } } };
    await db.activityLog.deleteMany({ where: { userId: actor?.id } });
    await db.roomBlock.deleteMany({ where: { room: { name: { startsWith: tag } } } });
    await db.booking.deleteMany({ where: { reservation: mine } });
    await db.reservation.deleteMany({ where: mine });
    await db.guest.deleteMany({ where: { email: { startsWith: tag } } });
    await db.room.deleteMany({ where: { name: { startsWith: tag } } });
    await db.roomType.deleteMany({ where: { slug: { startsWith: tag } } });
    await db.user.deleteMany({ where: { email: { startsWith: tag } } });
    await db.$disconnect();
  });

  it("moves a room to a free room of its type and logs it", async () => {
    const a = await stay(deluxe, rooms.deluxe[0], "01", 10, 12, "free");
    const outcome = await move({ bookingId: a.bookingId, roomId: rooms.deluxe[1] });
    expect(outcome).toMatchObject({ roomChanged: true, datesChanged: false });
    expect((await line(a.bookingId)).roomId).toBe(rooms.deluxe[1]);
    const log = await db.activityLog.findFirst({ where: { userId: actor.id, entityId: a.reservationId, action: "reservation.moved" } });
    expect(log).not.toBeNull();
  });

  it("refuses a busy room and leaves the booking where it was", async () => {
    const a = await stay(deluxe, rooms.deluxe[0], "02", 10, 12, "busy-a");
    await stay(deluxe, rooms.deluxe[1], "02", 11, 13, "busy-b");
    await expect(move({ bookingId: a.bookingId, roomId: rooms.deluxe[1] })).rejects.toThrow(/already booked/);
    expect((await line(a.bookingId)).roomId).toBe(rooms.deluxe[0]);
  });

  it("refuses a room of another type", async () => {
    const a = await stay(deluxe, rooms.deluxe[0], "03", 10, 12, "type");
    await expect(move({ bookingId: a.bookingId, roomId: rooms.family[0] })).rejects.toThrow(/not a room of this booking's type/);
    expect((await line(a.bookingId)).roomId).toBe(rooms.deluxe[0]);
  });

  it("refuses extending into a conflict, then allows it once the way is clear", async () => {
    const a = await stay(deluxe, rooms.deluxe[0], "04", 10, 12, "ext-a");
    const b = await stay(deluxe, rooms.deluxe[0], "04", 12, 14, "ext-b");
    await expect(move({ bookingId: a.bookingId, checkOut: "2032-04-13" })).rejects.toThrow(/already booked/);
    expect(toIso((await reservation(a.reservationId)).checkOut)).toBe("2032-04-12");
    // The check-out day itself is free for the next guest: shifting b out of the way lets a extend.
    await move({ bookingId: b.bookingId, checkIn: "2032-04-14", checkOut: "2032-04-16" });
    await expect(move({ bookingId: a.bookingId, checkOut: "2032-04-14" })).resolves.toMatchObject({ datesChanged: true });
  });

  it("moves the dates of every room together and reprices from each room's own rates", async () => {
    const first = await stay(deluxe, rooms.deluxe[0], "05", 10, 12, "multi");
    expect((await reservation(first.reservationId)).totalPriceNpr).toBe(6000);
    const outcome = await move({ bookingId: first.bookingId, checkOut: "2032-05-13" });
    expect(outcome.to.totalNpr).toBe(9000);
    expect((await line(first.bookingId)).totalPriceNpr).toBe(9000);
    expect((await reservation(first.reservationId)).totalPriceNpr).toBe(9000);
  });

  it("moves the room and the dates in one go, or neither", async () => {
    const a = await stay(deluxe, rooms.deluxe[0], "06", 10, 12, "both");
    await stay(deluxe, rooms.deluxe[1], "06", 14, 16, "both-blocker");
    await expect(move({ bookingId: a.bookingId, roomId: rooms.deluxe[1], checkIn: "2032-06-13", checkOut: "2032-06-15" })).rejects.toThrow(/already booked/);
    const unchanged = await line(a.bookingId);
    expect([unchanged.roomId, toIso(unchanged.checkIn)]).toEqual([rooms.deluxe[0], "2032-06-10"]);
    await move({ bookingId: a.bookingId, roomId: rooms.deluxe[1], checkIn: "2032-06-12", checkOut: "2032-06-14" });
    const moved = await line(a.bookingId);
    expect([moved.roomId, toIso(moved.checkIn), toIso(moved.checkOut)]).toEqual([rooms.deluxe[1], "2032-06-12", "2032-06-14"]);
  });

  it("checked-in stays: only the check-out can move", async () => {
    const a = await stay(deluxe, rooms.deluxe[0], "07", 10, 12, "in");
    await inTx((tx) => svc.transitionLine(tx, a.bookingId, "CHECKED_IN", async () => ({ checkedInAt: new Date() })));
    await expect(move({ bookingId: a.bookingId, roomId: rooms.deluxe[1] })).rejects.toThrow(/stay in their room/);
    await expect(move({ bookingId: a.bookingId, checkIn: "2032-07-09" })).rejects.toThrow(/Check-in can't change/);
    await expect(move({ bookingId: a.bookingId, checkOut: "2032-07-14" })).resolves.toMatchObject({ datesChanged: true });
    expect(toIso((await line(a.bookingId)).checkOut)).toBe("2032-07-14");
  });

  it("checked-out and cancelled stays can't be changed", async () => {
    const out = await stay(deluxe, rooms.deluxe[0], "08", 10, 12, "out");
    await inTx((tx) => svc.transitionLine(tx, out.bookingId, "CHECKED_IN", async () => ({ checkedInAt: new Date() })));
    await inTx((tx) => svc.transitionLine(tx, out.bookingId, "CHECKED_OUT", async () => ({ checkedOutAt: new Date() })));
    await expect(move({ bookingId: out.bookingId, roomId: rooms.deluxe[1] })).rejects.toThrow(/checked out/);
    const gone = await stay(deluxe, rooms.deluxe[1], "08", 20, 22, "gone");
    await inTx((tx) => svc.cancelLineWithReason(tx, gone.bookingId, "test"));
    await expect(move({ bookingId: gone.bookingId, checkOut: "2032-08-25" })).rejects.toThrow(/cancelled/);
  });

  it("undo: moving back restores the room, dates and total", async () => {
    const a = await stay(deluxe, rooms.deluxe[0], "09", 10, 12, "undo");
    const outcome = await move({ bookingId: a.bookingId, roomId: rooms.deluxe[2], checkIn: "2032-09-11", checkOut: "2032-09-14" });
    await move({ bookingId: a.bookingId, roomId: outcome.from.roomId!, checkIn: outcome.from.checkIn, checkOut: outcome.from.checkOut });
    const back = await line(a.bookingId);
    expect([back.roomId, toIso(back.checkIn), toIso(back.checkOut), back.totalPriceNpr]).toEqual([rooms.deluxe[0], "2032-09-10", "2032-09-12", 6000]);
    expect((await reservation(a.reservationId)).totalPriceNpr).toBe(6000);
  });

  it("undo is refused if the old spot was taken in the meantime", async () => {
    const a = await stay(deluxe, rooms.deluxe[0], "10", 10, 12, "undo-taken");
    await move({ bookingId: a.bookingId, roomId: rooms.deluxe[1] });
    await stay(deluxe, rooms.deluxe[0], "10", 10, 12, "taker");
    await expect(move({ bookingId: a.bookingId, roomId: rooms.deluxe[0] })).rejects.toThrow(/already booked/);
    expect((await line(a.bookingId)).roomId).toBe(rooms.deluxe[1]);
  });

  it("assign-by-drop: a pending request is confirmed into a free room, not a busy one", async () => {
    const pending = await db.$transaction(
      (tx) =>
        create(tx, {
          roomTypes: types(),
          checkIn: d("2032-11-10"),
          checkOut: d("2032-11-12"),
          lines: [{ roomTypeId: deluxe.id, adults: 2, children: 0 }],
          guest: { name: `${tag}-assign`, email: `${tag}-assign@example.test`, phone: null },
          source: "WEBSITE",
        }),
      { timeout: 15_000 },
    );
    const bookingId = pending.bookings[0].id;
    await stay(deluxe, rooms.deluxe[0], "11", 10, 12, "assign-busy");
    // (the busy room is in November too)
    await expect(inTx((tx) => svc.confirmLineInRoom(tx, bookingId, rooms.deluxe[0]))).rejects.toThrow(/already booked/);
    await inTx((tx) => svc.confirmLineInRoom(tx, bookingId, rooms.deluxe[1]));
    const confirmed = await line(bookingId);
    expect([confirmed.status, confirmed.roomId]).toEqual(["CONFIRMED", rooms.deluxe[1]]);
  });

  it("blocks: move and resize, but never onto a booking", async () => {
    await stay(deluxe, rooms.deluxe[0], "12", 10, 12, "block-guest");
    const block = await db.roomBlock.create({ data: { roomId: rooms.deluxe[1], startDate: d("2032-12-01"), endDate: d("2032-12-03"), reason: "Repairs", createdById: actor.id } });
    await inTx((tx) => tape.applyBlockMove(tx, actor.id, { blockId: block.id, startDate: "2032-12-02", endDate: "2032-12-06" }));
    const moved = await db.roomBlock.findUniqueOrThrow({ where: { id: block.id } });
    expect([toIso(moved.startDate), toIso(moved.endDate)]).toEqual(["2032-12-02", "2032-12-06"]);
    await expect(inTx((tx) => tape.applyBlockMove(tx, actor.id, { blockId: block.id, roomId: rooms.deluxe[0], startDate: "2032-12-09", endDate: "2032-12-11" }))).rejects.toThrow(/has a booking/);
    expect((await db.roomBlock.findUniqueOrThrow({ where: { id: block.id } })).roomId).toBe(rooms.deluxe[1]);
  });

  it("two moves into the same room at once: exactly one wins", async () => {
    const a = await stay(deluxe, rooms.deluxe[0], "03", 20, 22, "race-a");
    const b = await stay(deluxe, rooms.deluxe[1], "03", 20, 22, "race-b");
    const results = await Promise.allSettled([move({ bookingId: a.bookingId, roomId: rooms.deluxe[2] }), move({ bookingId: b.bookingId, roomId: rooms.deluxe[2] })]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });

  const toIso = (date: Date) => date.toISOString().slice(0, 10);
});
