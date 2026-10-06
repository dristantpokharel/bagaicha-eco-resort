/**
 * Runs against the real (dev) database to prove the lock and the CHECK
 * constraints work. Opt in with `npm run test:db`; plain `npm test` stays offline.
 * Every row is created with a unique prefix and only those rows are removed.
 */
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ AuthorizationError: class extends Error {} }));

config({ path: ".env.local", quiet: true });
const enabled = process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!enabled)("stock movements against the database", { timeout: 60_000 }, () => {
  const tag = `zz-test-${Date.now().toString(36)}`;
  let db: typeof import("@/lib/db").db;
  let record: typeof import("./service").recordStockMovement;
  let transfer: typeof import("./service").transferStock;
  let writeOff: typeof import("./service").writeOffStock;
  let storeId: string;
  let laundryId: string;
  let userId: string;
  const itemIds: string[] = [];

  async function makeItem(suffix: string, unit = "kg", quantity = "0") {
    const item = await db.inventoryItem.create({
      data: { name: `${tag}-${suffix}`, category: "Test", unit, quantity, lowStockThreshold: "1" },
    });
    itemIds.push(item.id);
    return item.id;
  }
  const move = (
    itemId: string,
    type: "RECEIVED" | "USED" | "ADJUSTED",
    amount: string,
    note: string | null = null,
    submissionId?: string,
  ) => db.$transaction((tx) => record(tx, { itemId, userId, type, amount, note, submissionId }));

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ recordStockMovement: record, transferStock: transfer, writeOffStock: writeOff } = await import("./service"));
    storeId = (await db.stockLocation.findFirstOrThrow({ where: { kind: "STORE" } })).id;
    laundryId = (await db.stockLocation.findFirstOrThrow({ where: { kind: "LAUNDRY" } })).id;
    const user = await db.user.create({
      data: { name: "Inventory test", email: `${tag}@example.test`, passwordHash: "x", role: "STAFF" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (!db) return;
    await db.activityLog.deleteMany({ where: { OR: [{ userId }, { entityId: { in: itemIds } }] } });
    await db.stockMovement.deleteMany({ where: { itemId: { in: itemIds } } });
    await db.stockBalance.deleteMany({ where: { itemId: { in: itemIds } } });
    await db.inventoryItem.deleteMany({ where: { id: { in: itemIds } } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  it("writes the quantity, movement row and activity entry together", async () => {
    const id = await makeItem("basic");
    await move(id, "RECEIVED", "10");
    const result = await move(id, "USED", "2.5", "Breakfast");
    expect(result.balanceAfter.toString()).toBe("7.5");

    const item = await db.inventoryItem.findUniqueOrThrow({ where: { id } });
    const movements = await db.stockMovement.findMany({ where: { itemId: id }, orderBy: { createdAt: "asc" } });
    expect(item.quantity.toString()).toBe("7.5");
    expect(movements.map((m) => m.quantity.toString())).toEqual(["10", "-2.5"]);
    expect(movements[1].balanceAfter.toString()).toBe("7.5");
    expect(movements[1].userId).toBe(userId);

    const logs = await db.activityLog.findMany({ where: { entityId: id }, orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => l.action)).toEqual(["stock.received", "stock.used"]);
  });

  it("refuses to take stock below zero and leaves nothing behind", async () => {
    const id = await makeItem("floor");
    await move(id, "RECEIVED", "3");
    await expect(move(id, "USED", "3.01")).rejects.toThrow();
    expect((await db.inventoryItem.findUniqueOrThrow({ where: { id } })).quantity.toString()).toBe("3");
    expect(await db.stockMovement.count({ where: { itemId: id } })).toBe(1);
  });

  it("lets only one of two simultaneous uses win when stock covers one", async () => {
    const id = await makeItem("race");
    await move(id, "RECEIVED", "5");
    const results = await Promise.allSettled([move(id, "USED", "4"), move(id, "USED", "4")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect((await db.inventoryItem.findUniqueOrThrow({ where: { id } })).quantity.toString()).toBe("1");
  });

  it("keeps quantity equal to the sum of movements after a mix of operations", async () => {
    const id = await makeItem("sum");
    await Promise.all([move(id, "RECEIVED", "20"), move(id, "RECEIVED", "5.25")]);
    await move(id, "USED", "7.5");
    await move(id, "ADJUSTED", "12", "Counted");
    await Promise.allSettled([move(id, "USED", "1"), move(id, "USED", "2"), move(id, "RECEIVED", "0.75")]);
    const item = await db.inventoryItem.findUniqueOrThrow({ where: { id } });
    const sum = await db.stockMovement.aggregate({ where: { itemId: id }, _sum: { quantity: true } });
    expect(item.quantity.toString()).toBe(sum._sum.quantity!.toString());
  });

  it("records a repeated submission once, even when the repeats arrive together", async () => {
    const id = await makeItem("dedupe");
    await move(id, "RECEIVED", "10");
    const token = `${tag}-token-a`;
    const first = await move(id, "USED", "2", null, token);
    const again = await move(id, "USED", "2", null, token);
    expect(first.duplicate).toBe(false);
    expect(again.duplicate).toBe(true);
    expect(again.summary).toMatch(/^Already saved\./);

    const burst = await Promise.all([1, 2, 3].map(() => move(id, "USED", "1", null, `${tag}-token-b`)));
    expect(burst.filter((r) => !r.duplicate)).toHaveLength(1);

    expect((await db.inventoryItem.findUniqueOrThrow({ where: { id } })).quantity.toString()).toBe("7");
    expect(await db.stockMovement.count({ where: { itemId: id } })).toBe(3);
    expect(await db.activityLog.count({ where: { entityId: id, action: "stock.used" } })).toBe(2);
    // A new token is a new movement.
    expect((await move(id, "USED", "2", null, `${tag}-token-c`)).duplicate).toBe(false);
  });

  it("refuses a token that was already used for another item", async () => {
    const a = await makeItem("tok-a", "kg", "5");
    const b = await makeItem("tok-b", "kg", "5");
    const token = `${tag}-token-d`;
    await move(a, "USED", "1", null, token);
    await expect(move(b, "USED", "1", null, token)).rejects.toThrow(/already used/);
  });

  it("rejects movements on archived items", async () => {
    const id = await makeItem("archived");
    await db.inventoryItem.update({ where: { id }, data: { isActive: false } });
    await expect(move(id, "RECEIVED", "1")).rejects.toThrow(/archived/);
  });

  it("rejects a fractional amount for a whole-number unit", async () => {
    const id = await makeItem("pcs", "pcs", "5");
    await expect(move(id, "USED", "1.5")).rejects.toThrow();
  });

  it("has CHECK constraints behind the app rules", async () => {
    const id = await makeItem("checks", "kg", "2");
    await expect(db.inventoryItem.update({ where: { id }, data: { quantity: "-1" } })).rejects.toThrow();
    await expect(
      db.stockMovement.create({ data: { itemId: id, userId, type: "USED", quantity: "1", balanceAfter: "1" } }),
    ).rejects.toThrow();
    await expect(
      db.stockMovement.create({ data: { itemId: id, userId, type: "RECEIVED", quantity: "-1", balanceAfter: "1" } }),
    ).rejects.toThrow();
    await expect(
      db.stockMovement.create({ data: { itemId: id, userId, type: "ADJUSTED", quantity: "0", balanceAfter: "2" } }),
    ).rejects.toThrow();
  });

  it("treats item names as unique ignoring case", async () => {
    await makeItem("Dup");
    await expect(
      db.inventoryItem.create({ data: { name: `${tag}-DUP`, category: "Test", unit: "kg" } }),
    ).rejects.toThrow();
  });

  describe("reusable items by location", () => {
    async function makeReusable(suffix: string, stock = "10") {
      const item = await db.inventoryItem.create({
        data: { name: `${tag}-r-${suffix}`, category: "Test", unit: "pcs", isConsumable: false },
      });
      itemIds.push(item.id);
      if (Number(stock) > 0) await move(item.id, "RECEIVED", stock);
      return item.id;
    }
    const send = (itemId: string, from: string, to: string, amount: string, submissionId?: string) =>
      db.$transaction((tx) =>
        transfer(tx, { itemId, userId, fromLocationId: from, toLocationId: to, amount, note: null, submissionId }),
      );
    const lose = (itemId: string, kind: "LOST" | "DAMAGED", from: string, amount: string, note: string | null) =>
      db.$transaction((tx) => writeOff(tx, { itemId, userId, kind, fromLocationId: from, amount, note }));
    const balances = async (itemId: string) =>
      Object.fromEntries(
        (await db.stockBalance.findMany({ where: { itemId } })).map((b) => [b.locationId, b.quantity.toString()]),
      );
    const total = async (itemId: string) => (await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } })).quantity.toString();

    it("puts deliveries in the Store and keeps the total equal to the balances", async () => {
      const id = await makeReusable("recv", "10");
      expect(await balances(id)).toEqual({ [storeId]: "10" });
      expect(await total(id)).toBe("10");
    });

    it("moves stock between places without changing the total", async () => {
      const id = await makeReusable("move", "10");
      await send(id, storeId, laundryId, "4");
      expect(await balances(id)).toEqual({ [storeId]: "6", [laundryId]: "4" });
      expect(await total(id)).toBe("10");

      const moved = await db.stockMovement.findFirstOrThrow({ where: { itemId: id, type: "TRANSFERRED" } });
      expect(moved.quantity.toString()).toBe("4");
      expect(moved.balanceAfter.toString()).toBe("10");
      expect(moved.fromLocationId).toBe(storeId);
      expect(moved.toLocationId).toBe(laundryId);

      // The total is the sum of every movement except moves.
      const sum = await db.stockMovement.aggregate({ where: { itemId: id, type: { not: "TRANSFERRED" } }, _sum: { quantity: true } });
      expect(sum._sum.quantity!.toString()).toBe("10");
    });

    it("refuses to move more than a place holds, or to the same place, and changes nothing", async () => {
      const id = await makeReusable("short", "3");
      await expect(send(id, storeId, laundryId, "3.5")).rejects.toThrow();
      await expect(send(id, storeId, laundryId, "4")).rejects.toThrow(/Only 3 pcs at Store/);
      await expect(send(id, laundryId, storeId, "1")).rejects.toThrow(/Only 0 pcs at Laundry/);
      await expect(send(id, storeId, storeId, "1")).rejects.toThrow(/two different places/);
      expect(await balances(id)).toEqual({ [storeId]: "3" });
      expect(await db.stockMovement.count({ where: { itemId: id, type: "TRANSFERRED" } })).toBe(0);
    });

    it("lets only one of two simultaneous moves win when stock covers one", async () => {
      const id = await makeReusable("race", "5");
      const results = await Promise.allSettled([send(id, storeId, laundryId, "4"), send(id, storeId, laundryId, "4")]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await balances(id)).toEqual({ [storeId]: "1", [laundryId]: "4" });
      expect(await total(id)).toBe("5");
    });

    it("writes off lost or damaged stock from one place and lowers the total", async () => {
      const id = await makeReusable("lost", "10");
      await send(id, storeId, laundryId, "3");
      await lose(id, "DAMAGED", laundryId, "1", "Torn in the wash");
      await lose(id, "LOST", storeId, "2", "Guest took it");
      expect(await balances(id)).toEqual({ [storeId]: "5", [laundryId]: "2" });
      expect(await total(id)).toBe("7");

      const damaged = await db.stockMovement.findFirstOrThrow({ where: { itemId: id, type: "DAMAGED" } });
      expect(damaged.quantity.toString()).toBe("-1");
      expect(damaged.balanceAfter.toString()).toBe("9");
      expect(damaged.note).toBe("Torn in the wash");
      const sum = await db.stockMovement.aggregate({ where: { itemId: id, type: { not: "TRANSFERRED" } }, _sum: { quantity: true } });
      expect(sum._sum.quantity!.toString()).toBe("7");
    });

    it("needs a note and enough stock to write off", async () => {
      const id = await makeReusable("lost-rules", "2");
      await expect(lose(id, "LOST", storeId, "1", null)).rejects.toThrow(/Say what happened/);
      await expect(lose(id, "LOST", storeId, "1", "   ")).rejects.toThrow(/Say what happened/);
      await expect(lose(id, "LOST", storeId, "3", "Gone")).rejects.toThrow(/Only 2 pcs at Store/);
      expect(await total(id)).toBe("2");
    });

    it("counts one place at a time and adjusts the total by the difference", async () => {
      const id = await makeReusable("count", "10");
      await send(id, storeId, laundryId, "4");
      await db.$transaction((tx) =>
        record(tx, { itemId: id, userId, type: "ADJUSTED", amount: "3", note: "Recount", locationId: laundryId }),
      );
      expect(await balances(id)).toEqual({ [storeId]: "6", [laundryId]: "3" });
      expect(await total(id)).toBe("9");
      // Counting with no place means the Store.
      await move(id, "ADJUSTED", "8", "Recount");
      expect(await balances(id)).toEqual({ [storeId]: "8", [laundryId]: "3" });
      expect(await total(id)).toBe("11");
    });

    it("keeps reusable and consumable rules apart", async () => {
      const reusable = await makeReusable("rules", "5");
      await expect(move(reusable, "USED", "1")).rejects.toThrow(/reusable/);
      const consumable = await makeItem("r-rules-cons", "pcs", "5");
      await expect(send(consumable, storeId, laundryId, "1")).rejects.toThrow(/consumable/);
      await expect(lose(consumable, "LOST", storeId, "1", "x")).rejects.toThrow(/consumable/);
    });

    it("records a repeated move once", async () => {
      const id = await makeReusable("dedupe", "10");
      const token = `${tag}-move-token`;
      const first = await send(id, storeId, laundryId, "2", token);
      const again = await send(id, storeId, laundryId, "2", token);
      expect(first.duplicate).toBe(false);
      expect(again.duplicate).toBe(true);
      expect(await balances(id)).toEqual({ [storeId]: "8", [laundryId]: "2" });
    });

    it("has CHECK constraints behind the location rules", async () => {
      const id = await makeReusable("loc-checks", "5");
      await expect(db.stockBalance.update({ where: { itemId_locationId: { itemId: id, locationId: storeId } }, data: { quantity: "-1" } })).rejects.toThrow();
      const base = { itemId: id, userId, balanceAfter: "5" };
      await expect(db.stockMovement.create({ data: { ...base, type: "TRANSFERRED", quantity: "1" } })).rejects.toThrow();
      await expect(
        db.stockMovement.create({ data: { ...base, type: "TRANSFERRED", quantity: "1", fromLocationId: storeId, toLocationId: storeId } }),
      ).rejects.toThrow();
      await expect(db.stockMovement.create({ data: { ...base, type: "LOST", quantity: "-1" } })).rejects.toThrow();
      await expect(
        db.stockMovement.create({ data: { ...base, type: "DAMAGED", quantity: "1", fromLocationId: storeId } }),
      ).rejects.toThrow();
      // Only one Store and one Laundry may exist, and a room location needs a room.
      await expect(db.stockLocation.create({ data: { kind: "STORE" } })).rejects.toThrow();
      await expect(db.stockLocation.create({ data: { kind: "ROOM" } })).rejects.toThrow();
    });

    it("never leaves a reusable item whose total differs from its balances", async () => {
      const { findBalanceMismatches } = await import("./queries");
      const id = await makeReusable("sum-check", "12");
      await send(id, storeId, laundryId, "5");
      await lose(id, "LOST", laundryId, "1", "Gone");
      await db.$transaction((tx) => record(tx, { itemId: id, userId, type: "ADJUSTED", amount: "3", note: "Recount", locationId: laundryId }));
      expect((await findBalanceMismatches()).filter((row) => row.id === id)).toEqual([]);
    });
  });
});
