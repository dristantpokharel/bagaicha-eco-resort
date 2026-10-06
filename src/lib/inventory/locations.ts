import type { Prisma } from "@/generated/prisma/client";
import type { StockLocationKind } from "@/generated/prisma/enums";
import { ActionError } from "@/lib/actions";
import { toDecimal, type Quantity } from "./stock";

type Tx = Prisma.TransactionClient;

export type LocationRef = {
  id: string;
  kind: StockLocationKind;
  /** "Store", "Laundry" or the room's name. */
  label: string;
  /** Rooms follow the room's active state; Store and Laundry are always active. */
  isActive: boolean;
};

export const locationInclude = { room: { select: { name: true, isActive: true } } } as const;

type LocationRow = { id: string; kind: StockLocationKind; room: { name: string; isActive: boolean } | null };

/** The one place a location's name comes from: Store, Laundry, or the room itself. */
export function toLocationRef(row: LocationRow): LocationRef {
  if (row.kind === "STORE") return { id: row.id, kind: row.kind, label: "Store", isActive: true };
  if (row.kind === "LAUNDRY") return { id: row.id, kind: row.kind, label: "Laundry", isActive: true };
  return { id: row.id, kind: row.kind, label: row.room?.name ?? "Room", isActive: row.room?.isActive ?? false };
}

export async function loadLocation(tx: Tx, id: string): Promise<LocationRef> {
  const row = await tx.stockLocation.findUnique({ where: { id }, include: locationInclude });
  if (!row) throw new ActionError("That location no longer exists.");
  return toLocationRef(row);
}

/** Store and Laundry are created by a migration and never deleted. */
export async function loadFixedLocation(tx: Tx, kind: "STORE" | "LAUNDRY"): Promise<LocationRef> {
  const row = await tx.stockLocation.findFirst({ where: { kind }, include: locationInclude });
  if (!row) throw new Error(`The ${kind.toLowerCase()} location is missing. Run the database migrations.`);
  return toLocationRef(row);
}

/** Every room gets a stock location when it is created; called from room creation. */
export async function ensureRoomLocation(tx: Tx, roomId: string) {
  await tx.stockLocation.upsert({ where: { roomId }, update: {}, create: { kind: "ROOM", roomId } });
}

export async function getBalance(tx: Tx, itemId: string, locationId: string) {
  const row = await tx.stockBalance.findUnique({
    where: { itemId_locationId: { itemId, locationId } },
    select: { quantity: true },
  });
  return row ? row.quantity : toDecimal(0);
}

/** Callers hold the item lock (lockItem), so read-then-write here can't interleave. */
export async function setBalance(tx: Tx, itemId: string, locationId: string, quantity: Quantity) {
  await tx.stockBalance.upsert({
    where: { itemId_locationId: { itemId, locationId } },
    update: { quantity },
    create: { itemId, locationId, quantity },
  });
}
