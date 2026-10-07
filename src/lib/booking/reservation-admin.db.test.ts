/**
 * Confirm all, partial confirmation, cancelling and the status filters, against the throwaway Neon branch in
 * `.env.migration-test` (opt in with `npm run test:db:reservations`). Every row uses a unique tag and only those
 * rows are removed.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { loadMigrationTestEnv } from "@/test/migration-test-env";

vi.mock("@/lib/auth/session", () => ({ AuthorizationError: class extends Error {} }));

const env = loadMigrationTestEnv();

describe.skipIf(!env)("reservation admin changes against the database", { timeout: 180_000 }, () => {
  const tag = `zz-adm-${Date.now().toString(36)}`;
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  let db: typeof import("@/lib/db").db;
  let create: typeof import("./service").createReservationRecord;
  let svc: typeof import("./reservation-service");
  let derive: typeof import("./reservation-status").deriveReservationStatus;
  let resolution: typeof import("./reservation-status").resolutionEmail;
  let admin: typeof import("./admin-queries");
  let deluxe: Awaited<ReturnType<typeof makeType>>;
  let family: Awaited<ReturnType<typeof makeType>>;
  let rooms: { deluxe: string[]; family: string[] };

  const makeType = (slug: string, data: { basePriceNpr: number; maxGuests: number; maxAdults: number; sortOrder: number }) =>
    db.roomType.create({ data: { slug: `${tag}-${slug}`, name: `${tag} ${slug}`, description: "test", childPricePerNightNpr: 500, ...data } });
  const makeRoom = (roomTypeId: string, name: string) => db.room.create({ data: { roomTypeId, name: `${tag}-${name}` } }).then((r) => r.id);
  const types = () => new Map([deluxe, family].map((t) => [t.id, t]));
  const line = (t: { id: string }, adults: number, children = 0, roomId?: string) => ({ roomTypeId: t.id, adults, children, roomId });
  const guest = (n: string) => ({ name: `${tag}-${n}`, email: `${tag}-${n}@example.test`, phone: null });
  const request = (lines: ReturnType<typeof line>[], dates: { checkIn: Date; checkOut: Date }, who: string, extra: Record<string, unknown> = {}) =>
    db.$transaction((tx) => create(tx, { roomTypes: types(), ...dates, lines, guest: guest(who), source: "WEBSITE", ...extra }), { timeout: 15_000 });
  const inTx = <T,>(fn: (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) => db.$transaction(fn, { timeout: 15_000 });
  const linesOf = (reservationId: string) => db.booking.findMany({ where: { reservationId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const dates = (month: string) => ({ checkIn: d(`2032-${month}-10`), checkOut: d(`2032-${month}-12`) });
  /** Occupies a room with a confirmed one-room reservation (the way the admin does). */
  const occupy = (roomTypeId: string, roomId: string, when: { checkIn: Date; checkOut: Date }, who: string) =>
    request([line({ id: roomTypeId }, 1, 0, roomId)], when, who, { source: "PHONE", maxRooms: null });

  beforeAll(async () => {
    process.env.DATABASE_URL = env!.databaseUrl;
    process.env.DIRECT_URL = env!.directUrl;
    ({ db } = await import("@/lib/db"));
    ({ createReservationRecord: create } = await import("./service"));
    svc = await import("./reservation-service");
    ({ deriveReservationStatus: derive, resolutionEmail: resolution } = await import("./reservation-status"));
    admin = await import("./admin-queries");
    deluxe = await makeType("deluxe", { basePriceNpr: 3000, maxGuests: 3, maxAdults: 2, sortOrder: 9101 });
    family = await makeType("family", { basePriceNpr: 4500, maxGuests: 6, maxAdults: 6, sortOrder: 9102 });
    rooms = {
      deluxe: [await makeRoom(deluxe.id, "d1"), await makeRoom(deluxe.id, "d2"), await makeRoom(deluxe.id, "d3")],
      family: [await makeRoom(family.id, "f1")],
    };
  });

  afterAll(async () => {
    if (!db) return;
    const mine = { guest: { email: { startsWith: tag } } };
    await db.booking.deleteMany({ where: { reservation: mine } });
    await db.reservation.deleteMany({ where: mine });
    await db.guest.deleteMany({ where: { email: { startsWith: tag } } });
    await db.room.deleteMany({ where: { name: { startsWith: tag } } });
    await db.roomType.deleteMany({ where: { slug: { startsWith: tag } } });
    await db.$disconnect();
  });

  it("confirm all gives every pending room its own free room, in one go", async () => {
    const { reservation } = await request([line(deluxe, 2), line(deluxe, 2), line(family, 3)], dates("01"), "all-ok");
    const result = await inTx((tx) => svc.confirmAllPending(tx, reservation.id));
    expect(result.confirmed).toBe(3);
    const lines = await linesOf(reservation.id);
    expect(lines.map((l) => l.status)).toEqual(["CONFIRMED", "CONFIRMED", "CONFIRMED"]);
    const assigned = lines.map((l) => l.roomId!);
    expect(new Set(assigned).size).toBe(3);
    expect(assigned.filter((id) => rooms.deluxe.includes(id))).toHaveLength(2);
    expect(assigned.filter((id) => rooms.family.includes(id))).toHaveLength(1);
    expect(derive(lines)).toBe("CONFIRMED");
    expect(resolution(lines)).toBe("confirmed");
  });

  it("confirm all is all-or-nothing: a type with too few free rooms leaves every room pending", async () => {
    const when = dates("02");
    await occupy(family.id, rooms.family[0], when, "all-busy");
    const { reservation } = await request([line(deluxe, 2), line(family, 3)], when, "all-short", { requireAvailability: false });
    await expect(inTx((tx) => svc.confirmAllPending(tx, reservation.id))).rejects.toThrow(/Not enough .* rooms are free.*Nothing was confirmed/);
    const lines = await linesOf(reservation.id);
    expect(lines.map((l) => [l.status, l.roomId])).toEqual([
      ["PENDING", null],
      ["PENDING", null],
    ]);
  });

  it("partial confirmation: some rooms confirmed, one cancelled with a reason", async () => {
    const when = dates("03");
    const { reservation, bookings } = await request([line(deluxe, 2), line(deluxe, 2), line(family, 3)], when, "partial");
    expect(reservation.totalPriceNpr).toBe(2 * 3000 + 2 * 3000 + 2 * 4500);

    // Confirm the first Deluxe into a named room; the guest isn't told anything until every room is decided.
    await inTx((tx) => svc.confirmLineInRoom(tx, bookings[0].id, rooms.deluxe[0]));
    let lines = await linesOf(reservation.id);
    expect(derive(lines)).toBe("PARTIALLY_CONFIRMED");
    expect(resolution(lines)).toBeNull();

    // Confirm the second, cancel the Family with a reason: now every room is decided.
    await inTx((tx) => svc.confirmLineInRoom(tx, bookings[1].id, rooms.deluxe[1]));
    await inTx((tx) => svc.cancelLineWithReason(tx, bookings[2].id, "Family Room closed for repairs"));
    lines = await linesOf(reservation.id);
    expect(lines.map((l) => l.status)).toEqual(["CONFIRMED", "CONFIRMED", "CANCELLED"]);
    expect(lines[2].cancellationReason).toBe("Family Room closed for repairs");
    expect(lines[2].cancelledAt).not.toBeNull();
    expect(derive(lines)).toBe("PARTIALLY_CONFIRMED");
    expect(resolution(lines)).toBe("partial");
    // The total follows the rooms that are kept; each room keeps its own saved price.
    expect((await db.reservation.findUniqueOrThrow({ where: { id: reservation.id } })).totalPriceNpr).toBe(12000);
    expect(lines.map((l) => l.totalPriceNpr)).toEqual([6000, 6000, 9000]);

    // The freed Family room can be booked again for the same dates.
    await request([line(family, 2)], when, "partial-again");
    await expect(inTx((tx) => svc.confirmAllPending(tx, reservation.id))).rejects.toThrow(/No rooms are waiting/);
  });

  it("cannot confirm into a room that is taken, and a cancelled room cannot be confirmed", async () => {
    const when = dates("04");
    await occupy(deluxe.id, rooms.deluxe[0], when, "taken");
    const { bookings } = await request([line(deluxe, 2), line(deluxe, 2)], when, "taken-line");
    await expect(inTx((tx) => svc.confirmLineInRoom(tx, bookings[0].id, rooms.deluxe[0]))).rejects.toThrow(/already booked/);
    await inTx((tx) => svc.cancelLineWithReason(tx, bookings[1].id, "no longer needed"));
    await expect(inTx((tx) => svc.confirmLineInRoom(tx, bookings[1].id, rooms.deluxe[1]))).rejects.toThrow(/cancelled/i);
    expect((await linesOf(bookings[0].reservationId))[0].status).toBe("PENDING");
  });

  it("cancel all cancels pending and confirmed rooms with one reason", async () => {
    const when = dates("05");
    const { reservation, bookings } = await request([line(deluxe, 2), line(deluxe, 2), line(family, 2)], when, "cancel-all");
    await inTx((tx) => svc.confirmLineInRoom(tx, bookings[0].id, rooms.deluxe[0]));
    const result = await inTx((tx) => svc.cancelOpenLines(tx, reservation.id, "Guest cancelled"));
    expect(result.cancelled).toBe(3);
    const lines = await linesOf(reservation.id);
    expect(lines.every((l) => l.status === "CANCELLED" && l.cancellationReason === "Guest cancelled")).toBe(true);
    expect(derive(lines)).toBe("CANCELLED");
    expect(resolution(lines)).toBe("cancelled");
    await expect(inTx((tx) => svc.cancelOpenLines(tx, reservation.id, "again"))).rejects.toThrow(/No rooms can be cancelled/);
  });

  it("two people deciding at once leaves one consistent state", async () => {
    const when = dates("06");
    const { bookings } = await request([line(deluxe, 2)], when, "race");
    const results = await Promise.allSettled([
      inTx((tx) => svc.confirmLineInRoom(tx, bookings[0].id, rooms.deluxe[0])),
      inTx((tx) => svc.cancelLineWithReason(tx, bookings[0].id, "changed mind")),
    ]);
    // Cancelling is allowed after confirming, so both may succeed one after the other; the end state must be consistent
    // (a cancelled room never keeps a confirmed status) and at least one of them must have gone through.
    const [final] = await linesOf(bookings[0].reservationId);
    expect(results.some((r) => r.status === "fulfilled")).toBe(true);
    if (results.every((r) => r.status === "fulfilled")) expect(final.status).toBe("CANCELLED");
    else expect(["CONFIRMED", "CANCELLED"]).toContain(final.status);
  });

  it("the list filter for each reservation status agrees with the derived status", async () => {
    const statuses = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"] as const;
    // Every combination of up to three rooms (order doesn't matter), each in its own dates so rooms can be reused.
    const combos: (typeof statuses)[number][][] = [];
    for (let a = 0; a < 5; a++) {
      combos.push([statuses[a]]);
      for (let b = a; b < 5; b++) {
        combos.push([statuses[a], statuses[b]]);
        for (let c = b; c < 5; c++) combos.push([statuses[a], statuses[b], statuses[c]]);
      }
    }
    const expected = new Map<string, string>();
    let day = 0;
    for (const combo of combos) {
      const checkIn = new Date(Date.UTC(2040, 0, 1 + day * 2));
      const checkOut = new Date(Date.UTC(2040, 0, 2 + day * 2));
      day++;
      const who = await db.guest.create({ data: { name: `${tag}-f${day}`, email: `${tag}-f${day}@example.test` } });
      let taken = 0;
      const created = await db.reservation.create({
        data: {
          reference: `${tag}-F${String(day).padStart(3, "0")}`,
          guestId: who.id,
          checkIn,
          checkOut,
          source: "PHONE",
          totalPriceNpr: 3000 * combo.length,
          bookings: {
            create: combo.map((status) => {
              const needsRoom = status !== "PENDING" && status !== "CANCELLED";
              return {
                roomTypeId: deluxe.id,
                roomId: needsRoom ? rooms.deluxe[taken++] : null,
                checkIn,
                checkOut,
                adults: 1,
                status,
                pricePerNightNpr: 3000,
                totalPriceNpr: 3000,
              };
            }),
          },
        },
      });
      expected.set(created.id, derive(combo.map((status) => ({ status }))));
    }

    const mine = { guest: { email: { startsWith: tag } }, reference: { contains: "-F" } };
    for (const status of admin.RESERVATION_STATUSES) {
      const found = await db.reservation.findMany({ where: { AND: [mine, admin.reservationStatusWhere(status)] }, select: { id: true } });
      const want = [...expected].filter(([, s]) => s === status).map(([id]) => id).sort();
      expect(found.map((r) => r.id).sort(), status).toEqual(want);
    }
    // Every status is exercised by the matrix.
    expect(new Set(expected.values())).toEqual(new Set(admin.RESERVATION_STATUSES));
  });
});
