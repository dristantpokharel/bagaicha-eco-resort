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
    ({ recordStockMovement: record } = await import("./service"));
    const user = await db.user.create({
      data: { name: "Inventory test", email: `${tag}@example.test`, passwordHash: "x", role: "STAFF" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (!db) return;
    await db.activityLog.deleteMany({ where: { OR: [{ userId }, { entityId: { in: itemIds } }] } });
    await db.stockMovement.deleteMany({ where: { itemId: { in: itemIds } } });
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
});
