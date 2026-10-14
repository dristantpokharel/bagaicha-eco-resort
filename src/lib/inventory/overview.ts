import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { RESORT_TIMEZONE, todayInResort } from "@/lib/dates";
import { resolvePar } from "@/lib/housekeeping/par";
import { toDecimal, type Quantity } from "./stock";
import { buildGrid, computeToBuy, summarizeLosses, type BuyArrival, type BuyRoom } from "./overview-calc";

export const ARRIVAL_WINDOW_DAYS = 7;

/** Midnight at the start of the current month in the resort's timezone, as an instant. */
export function monthStartInResort(now = new Date()): Date {
  return new Date(`${formatInTimeZone(now, RESORT_TIMEZONE, "yyyy-MM")}-01T00:00:00+05:45`);
}

const sum = (values: Iterable<Quantity>) => [...values].reduce<ReturnType<typeof toDecimal>>((total, v) => total.plus(v), toDecimal(0));

/** Everything the owner overview shows, read in one go. */
export async function loadOverview(now = new Date(), client: Pick<Prisma.TransactionClient, "room" | "inventoryItem" | "stockBalance" | "stockLocation" | "stockMovement" | "booking"> = db) {
  const today = todayInResort(now);
  const windowEnd = new Date(today.getTime() + ARRIVAL_WINDOW_DAYS * 86_400_000);
  const monthStart = monthStartInResort(now);

  const [rooms, items, balances, locations, losses, arrivals] = await Promise.all([
    client.room.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        dirtyCycle: true,
        roomType: { select: { parLines: { select: { itemId: true, quantity: true } } } },
        parOverrides: { select: { itemId: true, quantity: true } },
        stockLocation: { select: { id: true } },
        tasks: { where: { kind: "PREP" }, orderBy: { cycle: "desc" }, take: 1, select: { cycle: true, shortfalls: true } },
      },
    }),
    client.inventoryItem.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true, unit: true, isConsumable: true, isFixedInRoom: true, quantity: true, lowStockThreshold: true, unitCostNpr: true },
    }),
    client.stockBalance.findMany({ where: { quantity: { gt: 0 } }, select: { itemId: true, locationId: true, quantity: true } }),
    client.stockLocation.findMany({ select: { id: true, kind: true } }),
    client.stockMovement.findMany({
      where: { type: { in: ["LOST", "DAMAGED"] }, createdAt: { gte: monthStart } },
      orderBy: { createdAt: "desc" },
      select: { itemId: true, type: true, quantity: true, note: true, createdAt: true, item: { select: { name: true, unit: true, unitCostNpr: true } }, fromLocation: { select: { kind: true, room: { select: { name: true } } } } },
    }),
    client.booking.findMany({
      where: { status: "CONFIRMED", roomId: { not: null }, checkIn: { gte: today, lte: windowEnd } },
      select: { roomId: true, extras: { where: { appliedAt: null }, select: { itemId: true, quantity: true } } },
    }),
  ]);

  const byLocation = new Map<string, Map<string, Quantity>>();
  for (const b of balances) {
    const map = byLocation.get(b.locationId) ?? new Map<string, Quantity>();
    map.set(b.itemId, b.quantity);
    byLocation.set(b.locationId, map);
  }
  const placeMap = (kind: "STORE" | "LAUNDRY") => {
    const id = locations.find((l) => l.kind === kind)?.id;
    return (id && byLocation.get(id)) || new Map<string, Quantity>();
  };
  const store = placeMap("STORE");
  const laundry = placeMap("LAUNDRY");

  const reusable = items.filter((i) => !i.isConsumable);
  const roomViews = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    par: resolvePar(r.roomType.parLines, r.parOverrides),
    have: (r.stockLocation && byLocation.get(r.stockLocation.id)) || new Map<string, Quantity>(),
    flaggedShort: r.status === "READY" && r.tasks[0]?.cycle === r.dirtyCycle && r.tasks[0].shortfalls !== null,
  }));

  const grid = buildGrid(roomViews, reusable);

  const stock = items.map((item) => {
    const inStore = store.get(item.id) ?? toDecimal(0);
    const inLaundry = laundry.get(item.id) ?? toDecimal(0);
    const inRooms = sum(
      roomViews.map((r) => r.have.get(item.id) ?? 0),
    );
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      isConsumable: item.isConsumable,
      total: item.quantity.toString(),
      store: item.isConsumable ? null : inStore.toString(),
      laundry: item.isConsumable ? null : inLaundry.toString(),
      rooms: item.isConsumable ? null : inRooms.toString(),
      unitCostNpr: item.unitCostNpr,
    };
  });

  const lossSummary = summarizeLosses(
    losses.map((l) => ({ itemId: l.itemId, name: l.item.name, unit: l.item.unit, type: l.type as "LOST" | "DAMAGED", quantity: l.quantity, unitCostNpr: l.item.unitCostNpr })),
  );
  const lossDetails = losses.map((l) => ({
    at: l.createdAt,
    item: l.item.name,
    unit: l.item.unit,
    type: l.type as "LOST" | "DAMAGED",
    quantity: l.quantity.abs().toString(),
    where: l.fromLocation?.room?.name ?? (l.fromLocation?.kind === "LAUNDRY" ? "Laundry" : l.fromLocation?.kind === "STORE" ? "Store" : ""),
    note: l.note ?? "",
  }));

  const buyRooms: BuyRoom[] = roomViews.map((r) => ({ id: r.id, status: r.status, par: r.par, have: r.have, flaggedShort: r.flaggedShort }));
  const buyArrivals: BuyArrival[] = arrivals.map((a) => {
    const extras = new Map<string, ReturnType<typeof toDecimal>>();
    for (const e of a.extras) extras.set(e.itemId, (extras.get(e.itemId) ?? toDecimal(0)).plus(e.quantity));
    return { roomId: a.roomId!, extras };
  });
  const toBuy = computeToBuy({ items, rooms: buyRooms, arrivals: buyArrivals, store, laundry });

  return { grid, stock, losses: { ...lossSummary, details: lossDetails, monthStart }, toBuy, arrivalCount: arrivals.length, windowDays: ARRIVAL_WINDOW_DAYS };
}

export type Overview = Awaited<ReturnType<typeof loadOverview>>;
