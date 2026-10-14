/**
 * Prep, inspection and room status against a real database. Opt in with `npm run test:db:housekeeping`, which
 * supplies DATABASE_URL; plain `npm test` stays offline and skips this file. Every test runs inside one
 * transaction that is always rolled back, so nothing is left behind. The constraint checks use savepoints so a
 * rejected statement doesn't end the test.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ AuthorizationError: class extends Error {} }));

const enabled = process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);

class Rollback extends Error {}

describe.skipIf(!enabled)("housekeeping against the database", { timeout: 120_000 }, () => {
  const tag = `zz-test-${Date.now().toString(36)}`;
  let db: typeof import("@/lib/db").db;
  let svc: typeof import("./service");
  let status: typeof import("./room-status");
  let reservations: typeof import("@/lib/booking/reservation-service");
  let locations: typeof import("@/lib/inventory/locations");
  let todayInResort: typeof import("@/lib/dates").todayInResort;
  let ActionError: typeof import("@/lib/actions").ActionError;
  let todo: typeof import("./status").roomTodo;

  type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
  type Fixtures = Awaited<ReturnType<typeof fixtures>>;

  /** Runs a test body in a transaction and rolls it back, whatever happens. */
  async function inRollback(body: (tx: Tx, f: Fixtures) => Promise<void>) {
    await db
      .$transaction(
        async (tx) => {
          await body(tx, await fixtures(tx));
          throw new Rollback();
        },
        { timeout: 60_000, maxWait: 20_000 },
      )
      .catch((error) => {
        if (!(error instanceof Rollback)) throw error;
      });
  }

  /** A room type with one room, par list (2 towels, 1 kettle, 2 soap), stocked store, two staff, one arrival. */
  async function fixtures(tx: Tx) {
    const [user, other] = await Promise.all(
      ["a", "b"].map((n) => tx.user.create({ data: { name: `${tag} ${n}`, email: `${tag}-${n}@example.test`, passwordHash: "x", role: "STAFF" } })),
    );
    const type = await tx.roomType.create({
      data: { slug: `${tag}-type`, name: `${tag} type`, description: "t", basePriceNpr: 1000, maxGuests: 2, maxAdults: 2 },
    });
    const room = await tx.room.create({ data: { roomTypeId: type.id, name: `${tag}-101` } });
    await locations.ensureRoomLocation(tx, room.id);
    const roomLoc = await tx.stockLocation.findUniqueOrThrow({ where: { roomId: room.id } });
    const store = await locations.loadFixedLocation(tx, "STORE");
    const laundry = await locations.loadFixedLocation(tx, "LAUNDRY");

    const item = (suffix: string, data: { isConsumable?: boolean; isFixedInRoom?: boolean; quantity: string }) =>
      tx.inventoryItem.create({ data: { name: `${tag}-${suffix}`, category: "Test", unit: "pcs", ...data } });
    const towel = await item("towel", { quantity: "5", isConsumable: false });
    const kettle = await item("kettle", { quantity: "2", isConsumable: false, isFixedInRoom: true });
    const soap = await item("soap", { quantity: "10", isConsumable: true });
    await locations.setBalance(tx, towel.id, store.id, "5");
    await locations.setBalance(tx, kettle.id, store.id, "2");
    for (const [itemId, quantity] of [
      [towel.id, "2"],
      [kettle.id, "1"],
      [soap.id, "2"],
    ]) {
      await tx.parLine.create({ data: { roomTypeId: type.id, itemId, quantity } });
    }

    const tomorrow = new Date(todayInResort().getTime() + 86_400_000);
    const dayAfter = new Date(tomorrow.getTime() + 86_400_000);
    const guest = await tx.guest.create({ data: { name: `${tag} guest`, email: `${tag}@example.test` } });
    const reservation = await tx.reservation.create({
      data: {
        reference: `${tag}-ref`,
        guestId: guest.id,
        guestName: `${tag} guest`,
        guestEmail: `${tag}@example.test`,
        checkIn: tomorrow,
        checkOut: dayAfter,
        source: "PHONE",
        totalPriceNpr: 1000,
      },
    });
    const booking = await tx.booking.create({
      data: {
        reservationId: reservation.id,
        roomTypeId: type.id,
        roomId: room.id,
        checkIn: tomorrow,
        checkOut: dayAfter,
        adults: 1,
        status: "CONFIRMED",
        pricePerNightNpr: 1000,
        totalPriceNpr: 1000,
      },
    });
    return { user, other, type, room, roomLoc, store, laundry, towel, kettle, soap, booking };
  }

  const balance = async (tx: Tx, itemId: string, locationId: string) => (await locations.getBalance(tx, itemId, locationId)).toString();
  const dirty = (tx: Tx, f: Fixtures) => status.setRoomStatus(tx, { roomId: f.room.id, to: "DIRTY", note: null, userId: f.user.id });
  const cycleOf = async (tx: Tx, roomId: string) => (await tx.room.findUniqueOrThrow({ where: { id: roomId } })).dirtyCycle;
  const roomOf = (tx: Tx, f: Fixtures) => tx.room.findUniqueOrThrow({ where: { id: f.room.id } });
  const prep = async (tx: Tx, f: Fixtures, over: Partial<Parameters<typeof svc.completePrep>[1]> = {}) =>
    svc.completePrep(tx, {
      roomId: f.room.id,
      cycle: await cycleOf(tx, f.room.id),
      userId: f.user.id,
      quantities: { [f.towel.id]: "2", [f.kettle.id]: "1", [f.soap.id]: "2" },
      acknowledgeShortfall: false,
      ...over,
    });
  const checkIn = (tx: Tx, f: Fixtures) =>
    reservations.transitionLine(tx, f.booking.id, "CHECKED_IN", async () => ({ checkedInAt: new Date() }), f.user.id);
  const checkOut = (tx: Tx, f: Fixtures) =>
    reservations.transitionLine(tx, f.booking.id, "CHECKED_OUT", async () => ({ checkedOutAt: new Date() }), f.user.id);

  /** Runs a statement that must be rejected by the database, without ending the surrounding transaction. */
  async function rejected(tx: Tx, run: () => Promise<unknown>) {
    await tx.$executeRawUnsafe("SAVEPOINT guard");
    let error: unknown = null;
    try {
      await run();
    } catch (e) {
      error = e;
    }
    await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT guard");
    return error;
  }

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    svc = await import("./service");
    status = await import("./room-status");
    reservations = await import("@/lib/booking/reservation-service");
    locations = await import("@/lib/inventory/locations");
    ({ todayInResort } = await import("@/lib/dates"));
    ({ ActionError } = await import("@/lib/actions"));
    ({ roomTodo: todo } = await import("./status"));
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it("prep moves reusables Store → Room, records consumables as USED against the booking, and makes the room Ready", async () => {
    await inRollback(async (tx, f) => {
      await dirty(tx, f);
      const result = await prep(tx, f);
      expect(result.shortfalls).toEqual([]);

      expect(await balance(tx, f.towel.id, f.roomLoc.id)).toBe("2");
      expect(await balance(tx, f.towel.id, f.store.id)).toBe("3");
      expect(await balance(tx, f.kettle.id, f.roomLoc.id)).toBe("1");
      expect((await tx.inventoryItem.findUniqueOrThrow({ where: { id: f.soap.id } })).quantity.toString()).toBe("8");

      const moves = await tx.stockMovement.findMany({ where: { userId: f.user.id } });
      expect(moves.find((m) => m.itemId === f.soap.id)).toMatchObject({ type: "USED", bookingId: f.booking.id });
      expect(moves.filter((m) => m.type === "TRANSFERRED").every((m) => m.bookingId === f.booking.id)).toBe(true);

      const room = await roomOf(tx, f);
      expect(room.status).toBe("READY");
      const task = await tx.roomTask.findFirstOrThrow({ where: { roomId: f.room.id, kind: "PREP" } });
      expect(task).toMatchObject({ bookingId: f.booking.id, completedById: f.user.id, cycle: room.dirtyCycle });
      const log = await tx.activityLog.findMany({ where: { entityId: f.room.id } });
      expect(log.map((l) => l.action)).toEqual(expect.arrayContaining(["room.statusChanged", "room.prepCompleted"]));
    });
  });

  it("lets staff place less of a consumable, and records only what was placed", async () => {
    await inRollback(async (tx, f) => {
      await dirty(tx, f);
      await prep(tx, f, { quantities: { [f.towel.id]: "2", [f.kettle.id]: "1", [f.soap.id]: "0" } });
      expect((await tx.inventoryItem.findUniqueOrThrow({ where: { id: f.soap.id } })).quantity.toString()).toBe("10");
      expect(await tx.stockMovement.count({ where: { itemId: f.soap.id } })).toBe(0);
    });
  });

  it("flags a store shortfall, needs confirmation, places what exists and still makes the room Ready", async () => {
    await inRollback(async (tx, f) => {
      await locations.setBalance(tx, f.towel.id, f.store.id, "1");
      await tx.inventoryItem.update({ where: { id: f.towel.id }, data: { quantity: "1" } });
      await dirty(tx, f);

      await expect(prep(tx, f)).rejects.toThrow(/short on/);
      expect(await tx.roomTask.count({ where: { roomId: f.room.id } })).toBe(0);

      const result = await prep(tx, f, { acknowledgeShortfall: true });
      expect(result.shortfalls.map((s) => [s.name, s.placed, s.short])).toEqual([[`${tag}-towel`, "1", "1"]]);
      expect(await balance(tx, f.towel.id, f.roomLoc.id)).toBe("1");
      expect(await balance(tx, f.towel.id, f.store.id)).toBe("0");
      const task = await tx.roomTask.findFirstOrThrow({ where: { roomId: f.room.id, kind: "PREP" } });
      expect(task.shortfalls).toEqual([{ itemId: f.towel.id, item: `${tag}-towel`, short: "1" }]);
      expect((await roomOf(tx, f)).status).toBe("READY");
    });
  });

  it("preps any Dirty room, with or without an upcoming booking", async () => {
    await inRollback(async (tx, f) => {
      await tx.booking.update({ where: { id: f.booking.id }, data: { status: "CANCELLED", cancelledAt: new Date(), roomId: null } });
      await dirty(tx, f);
      await prep(tx, f);
      expect((await tx.roomTask.findFirstOrThrow({ where: { roomId: f.room.id } })).bookingId).toBeNull();
      expect((await tx.stockMovement.findMany({ where: { userId: f.user.id } })).every((m) => m.bookingId === null)).toBe(true);
    });
  });

  it("refuses to prep a room that is Ready, out of order, or still to be inspected", async () => {
    await inRollback(async (tx, f) => {
      await expect(prep(tx, f)).rejects.toThrow(/nothing to prepare/);
      await status.setRoomStatus(tx, { roomId: f.room.id, to: "OUT_OF_ORDER", note: "leak", userId: f.user.id });
      await expect(prep(tx, f)).rejects.toThrow(/out of order/);
      await status.setRoomStatus(tx, { roomId: f.room.id, to: "DIRTY", note: null, userId: f.user.id });
      await tx.room.update({ where: { id: f.room.id }, data: { inspectBookingId: f.booking.id } });
      await expect(prep(tx, f)).rejects.toThrow(/Inspect it first/);
    });
  });

  it("inspection: counted linen goes to the laundry, fixed items stay, missing ones are written off against the stay", async () => {
    await inRollback(async (tx, f) => {
      await locations.setBalance(tx, f.towel.id, f.roomLoc.id, "2");
      await locations.setBalance(tx, f.towel.id, f.store.id, "3");
      await locations.setBalance(tx, f.kettle.id, f.roomLoc.id, "1");
      await locations.setBalance(tx, f.kettle.id, f.store.id, "1");
      await tx.booking.update({ where: { id: f.booking.id }, data: { status: "CHECKED_IN", checkedInAt: new Date() } });
      await checkOut(tx, f);

      const cycle = await cycleOf(tx, f.room.id);
      // A missing towel with no reason is refused, and nothing is applied.
      await expect(
        svc.completeInspection(tx, { roomId: f.room.id, cycle, userId: f.user.id, entries: { [f.towel.id]: { counted: "1" }, [f.kettle.id]: { counted: "1" } } }),
      ).rejects.toThrow(ActionError);
      expect(await balance(tx, f.towel.id, f.roomLoc.id)).toBe("2");

      const result = await svc.completeInspection(tx, {
        roomId: f.room.id,
        cycle,
        userId: f.user.id,
        entries: { [f.towel.id]: { counted: "1", kind: "LOST", note: "guest took it" }, [f.kettle.id]: { counted: "1" } },
      });
      expect(result.plan.find((l) => l.itemId === f.towel.id)).toMatchObject({ missing: "1", toLaundry: "1" });

      expect(await balance(tx, f.towel.id, f.laundry.id)).toBe("1");
      expect(await balance(tx, f.towel.id, f.roomLoc.id)).toBe("0");
      expect(await balance(tx, f.kettle.id, f.roomLoc.id)).toBe("1");
      expect((await tx.inventoryItem.findUniqueOrThrow({ where: { id: f.towel.id } })).quantity.toString()).toBe("4");
      const lost = await tx.stockMovement.findFirstOrThrow({ where: { itemId: f.towel.id, type: "LOST" } });
      expect(lost).toMatchObject({ bookingId: f.booking.id, note: "guest took it" });

      expect(await roomOf(tx, f)).toMatchObject({ status: "DIRTY", inspectBookingId: null });
      expect((await tx.roomTask.findFirstOrThrow({ where: { roomId: f.room.id, kind: "INSPECTION" } })).bookingId).toBe(f.booking.id);
    });
  });

  it("check-in makes the room Occupied; check-out makes it Dirty with a new cycle and an inspection to do", async () => {
    await inRollback(async (tx, f) => {
      await checkIn(tx, f);
      expect((await roomOf(tx, f)).status).toBe("OCCUPIED");

      await checkOut(tx, f);
      expect(await roomOf(tx, f)).toMatchObject({ status: "DIRTY", dirtyCycle: 1, inspectBookingId: f.booking.id });
      const log = await tx.activityLog.findMany({ where: { entityId: f.room.id, action: "room.statusChanged" }, orderBy: { createdAt: "asc" } });
      expect(log.map((l) => (l.details as { reason: string }).reason)).toEqual(["checkin", "checkout"]);
    });
  });

  it("same-day turnaround: inspect first, then prep", async () => {
    await inRollback(async (tx, f) => {
      await checkIn(tx, f);
      await checkOut(tx, f);

      let room = await roomOf(tx, f);
      expect(todo({ status: room.status, inspectPending: room.inspectBookingId !== null })).toBe("INSPECT");
      await expect(prep(tx, f)).rejects.toThrow(/Inspect it first/);

      await svc.completeInspection(tx, { roomId: f.room.id, cycle: room.dirtyCycle, userId: f.user.id, entries: {} });
      room = await roomOf(tx, f);
      expect(room.status).toBe("DIRTY");
      expect(todo({ status: room.status, inspectPending: room.inspectBookingId !== null })).toBe("PREP");

      await prep(tx, f);
      expect((await roomOf(tx, f)).status).toBe("READY");
      // Both checklists in one dirty cycle: the unique key is per kind.
      expect(await tx.roomTask.count({ where: { roomId: f.room.id } })).toBe(2);
    });
  });

  it("a second person completing the same prep is turned away; the same person repeating is a no-op", async () => {
    await inRollback(async (tx, f) => {
      await dirty(tx, f);
      const cycle = await cycleOf(tx, f.room.id);
      await prep(tx, f);
      const quantities = { [f.towel.id]: "2", [f.kettle.id]: "1", [f.soap.id]: "2" };

      await expect(svc.completePrep(tx, { roomId: f.room.id, cycle, userId: f.other.id, quantities, acknowledgeShortfall: false })).rejects.toThrow(
        new RegExp(`${tag} a already completed`),
      );
      const again = await svc.completePrep(tx, { roomId: f.room.id, cycle, userId: f.user.id, quantities, acknowledgeShortfall: false });
      expect(again.duplicate).toBe(true);
      expect(await balance(tx, f.towel.id, f.roomLoc.id)).toBe("2");
    });
  });

  it("the database itself refuses a second completion for the same room, kind and cycle", async () => {
    await inRollback(async (tx, f) => {
      await dirty(tx, f);
      await prep(tx, f);
      const task = await tx.roomTask.findFirstOrThrow({ where: { roomId: f.room.id, kind: "PREP" } });
      const error = await rejected(tx, () =>
        tx.roomTask.create({ data: { roomId: f.room.id, kind: "PREP", cycle: task.cycle, completedById: f.other.id, lines: [] } }),
      );
      expect(error).toMatchObject({ code: "P2002" });
    });
  });

  it("the database itself refuses negative stock at a location and negative item totals", async () => {
    await inRollback(async (tx, f) => {
      const balanceError = await rejected(tx, () =>
        tx.stockBalance.update({ where: { itemId_locationId: { itemId: f.towel.id, locationId: f.store.id } }, data: { quantity: "-1" } }),
      );
      expect(balanceError).not.toBeNull();
      const totalError = await rejected(tx, () => tx.inventoryItem.update({ where: { id: f.towel.id }, data: { quantity: "-1" } }));
      expect(totalError).not.toBeNull();
    });
  });

  it("manual status changes are logged; Out of order needs a note; a guest inside blocks a change", async () => {
    await inRollback(async (tx, f) => {
      await expect(status.setRoomStatus(tx, { roomId: f.room.id, to: "OUT_OF_ORDER", note: null, userId: f.user.id })).rejects.toThrow(ActionError);
      await status.setRoomStatus(tx, { roomId: f.room.id, to: "OUT_OF_ORDER", note: "leaking tap", userId: f.user.id });
      expect(await roomOf(tx, f)).toMatchObject({ status: "OUT_OF_ORDER", statusNote: "leaking tap" });
      const log = await tx.activityLog.findFirstOrThrow({ where: { entityId: f.room.id, action: "room.statusChanged" } });
      expect(log.details).toMatchObject({ from: "READY", to: "OUT_OF_ORDER", reason: "manual", note: "leaking tap" });

      await status.setRoomStatus(tx, { roomId: f.room.id, to: "DIRTY", note: null, userId: f.user.id });
      await checkIn(tx, f);
      await expect(status.setRoomStatus(tx, { roomId: f.room.id, to: "READY", note: null, userId: f.user.id })).rejects.toThrow(/checked in/);
    });
  });
});
