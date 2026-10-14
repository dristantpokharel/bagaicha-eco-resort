import type { Prisma } from "@/generated/prisma/client";
import { ActionError } from "@/lib/actions";
import { logActivity } from "@/lib/activity-log";
import { lockRoom } from "@/lib/booking/availability";
import { lockReservation } from "@/lib/booking/reservation-service";
import { todayInResort } from "@/lib/dates";
import { lockItem, recordStockMovement, transferStock } from "@/lib/inventory/service";
import { loadFixedLocation } from "@/lib/inventory/locations";
import { assertAmountFitsUnit, formatQuantityWithUnit, toDecimal, type Quantity } from "@/lib/inventory/stock";
import { planExtraTiming, type ExtraTiming } from "./extras";

type Tx = Prisma.TransactionClient;

type BookingFacts = {
  id: string;
  reservationId: string;
  roomId: string | null;
  status: "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";
};

const bookingFacts = (tx: Tx, bookingId: string) =>
  tx.booking.findUnique({ where: { id: bookingId }, select: { id: true, reservationId: true, roomId: true, status: true } }) as Promise<BookingFacts | null>;

/**
 * Locks in the one global order: reservation → room → items. The booking is re-read after the locks, so a
 * check-out or room change that raced us is seen, not overwritten.
 */
async function lockBooking(tx: Tx, bookingId: string): Promise<BookingFacts> {
  const first = await bookingFacts(tx, bookingId);
  if (!first) throw new ActionError("That room booking no longer exists.");
  await lockReservation(tx, first.reservationId);
  if (first.roomId) await lockRoom(tx, first.roomId);
  const booking = await bookingFacts(tx, bookingId);
  if (!booking) throw new ActionError("That room booking no longer exists.");
  if (booking.roomId !== first.roomId) throw new ActionError("The room changed while you were adding this. Reload the page.");
  return booking;
}

export type AddExtraResult = { timing: ExtraTiming; summary: string };

/**
 * Adds an extra to one booking line. Applied at once when the room is already set up for the guest: reusables
 * move Store → Room (and come back at inspection), consumables are recorded as used. Otherwise it is saved and
 * shows on the prep checklist.
 */
export async function addExtra(
  tx: Tx,
  params: { bookingId: string; itemId: string; quantity: Quantity; note: string | null; userId: string },
): Promise<AddExtraResult> {
  const { bookingId, itemId, userId, note } = params;
  const booking = await lockBooking(tx, bookingId);

  const item = await tx.inventoryItem.findUnique({ where: { id: itemId }, select: { name: true, unit: true, isActive: true, isConsumable: true } });
  if (!item) throw new ActionError("That item no longer exists.", { itemId: "Choose an item." });
  if (!item.isActive) throw new ActionError(`${item.name} is archived, so it can't be added.`, { itemId: "Archived." });
  const quantity = toDecimal(params.quantity);
  if (quantity.lessThanOrEqualTo(0)) throw new ActionError("Enter an amount above zero.", { quantity: "Enter an amount above zero." });
  assertAmountFitsUnit(quantity, item.unit, "quantity");

  const room = booking.roomId
    ? await tx.room.findUnique({ where: { id: booking.roomId }, select: { name: true, status: true, stockLocation: { select: { id: true } } } })
    : null;
  const next =
    booking.roomId && booking.status === "CONFIRMED"
      ? await tx.booking.findFirst({
          where: { roomId: booking.roomId, status: "CONFIRMED", checkIn: { gte: todayInResort() } },
          orderBy: [{ checkIn: "asc" }, { id: "asc" }],
          select: { id: true },
        })
      : null;
  const timing = planExtraTiming({ bookingStatus: booking.status, hasRoom: Boolean(room), roomStatus: room?.status ?? null, isNextArrival: next?.id === booking.id });

  if (timing === "NOW") {
    if (!room?.stockLocation) throw new ActionError(`${room?.name ?? "The room"} has no stock location. Contact an admin.`);
    await lockItem(tx, itemId);
    const stockNote = `Extra for ${room.name}${note ? `: ${note}` : ""}`;
    if (item.isConsumable) {
      await recordStockMovement(tx, { itemId, userId, type: "USED", amount: quantity.toString(), note: stockNote, bookingId });
    } else {
      const store = await loadFixedLocation(tx, "STORE");
      await transferStock(tx, { itemId, userId, fromLocationId: store.id, toLocationId: room.stockLocation.id, amount: quantity.toString(), note: stockNote, bookingId });
    }
  }

  const extra = await tx.bookingExtra.create({
    data: { bookingId, itemId, quantity: quantity.toString(), note, addedById: userId, appliedAt: timing === "NOW" ? new Date() : null },
  });
  const amount = formatQuantityWithUnit(quantity.toString(), item.unit);
  await logActivity(tx, {
    userId,
    action: "booking.extraAdded",
    entityType: "Booking",
    entityId: bookingId,
    details: { extraId: extra.id, item: item.name, amount: quantity.toString(), unit: item.unit, timing, ...(room ? { room: room.name } : {}), ...(note ? { note } : {}) },
  });
  return {
    timing,
    summary:
      timing === "NOW"
        ? `${amount} of ${item.name} ${item.isConsumable ? "recorded as used" : `placed in ${room?.name}`}.`
        : `${amount} of ${item.name} saved. It will be on the prep checklist for ${room?.name ?? "the room"}.`,
  };
}

/** Removes an extra that is not in the room yet. One already placed comes back at inspection instead. */
export async function removeExtra(tx: Tx, params: { extraId: string; userId: string }): Promise<{ summary: string }> {
  const extra = await tx.bookingExtra.findUnique({ where: { id: params.extraId }, select: { bookingId: true, quantity: true, item: { select: { name: true, unit: true } } } });
  if (!extra) throw new ActionError("That extra was already removed.");
  await lockBooking(tx, extra.bookingId);

  // Conditional on appliedAt: a prep that finished while we waited for the lock wins.
  const { count } = await tx.bookingExtra.deleteMany({ where: { id: params.extraId, appliedAt: null } });
  if (count === 0) {
    const stillThere = await tx.bookingExtra.findUnique({ where: { id: params.extraId }, select: { id: true } });
    throw new ActionError(
      stillThere ? "That extra is already in the room, so it can't be removed here. It comes back at the checkout inspection." : "That extra was already removed.",
    );
  }
  await logActivity(tx, {
    userId: params.userId,
    action: "booking.extraRemoved",
    entityType: "Booking",
    entityId: extra.bookingId,
    details: { item: extra.item.name, amount: extra.quantity.toString(), unit: extra.item.unit },
  });
  return { summary: `${extra.item.name} removed.` };
}
