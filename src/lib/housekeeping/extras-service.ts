import type { Prisma } from "@/generated/prisma/client";
import type { RoomStatus } from "@/generated/prisma/enums";
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

export type AddExtraResult = { timing: ExtraTiming; summary: string; duplicate: boolean };

type RoomFacts = { name: string; status: RoomStatus; stockLocation: { id: string } | null };

/** Puts stock into the room for a booking: reusables Store → Room, consumables recorded as used. The one placing path. */
async function placeStock(
  tx: Tx,
  p: { bookingId: string; itemId: string; isConsumable: boolean; quantity: string; note: string | null; userId: string; room: RoomFacts | null },
) {
  if (!p.room?.stockLocation) throw new ActionError(`${p.room?.name ?? "The room"} has no stock location. Contact an admin.`);
  await lockItem(tx, p.itemId);
  const stockNote = `Extra for ${p.room.name}${p.note ? `: ${p.note}` : ""}`;
  if (p.isConsumable) {
    await recordStockMovement(tx, { itemId: p.itemId, userId: p.userId, type: "USED", amount: p.quantity, note: stockNote, bookingId: p.bookingId });
  } else {
    const store = await loadFixedLocation(tx, "STORE");
    await transferStock(tx, { itemId: p.itemId, userId: p.userId, fromLocationId: store.id, toLocationId: p.room.stockLocation.id, amount: p.quantity, note: stockNote, bookingId: p.bookingId });
  }
}

/** Is the room set up for this guest right now? The same rule whether an extra is added or applied later. */
async function timingFor(tx: Tx, booking: BookingFacts) {
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
  return { room, timing };
}

/**
 * Adds an extra to one booking line. Applied at once when the room is already set up for the guest: reusables
 * move Store → Room (and come back at inspection), consumables are recorded as used. Otherwise it is saved and
 * shows on the prep checklist. `submissionId` makes a repeat of the same form attempt a no-op.
 */
export async function addExtra(
  tx: Tx,
  params: { bookingId: string; itemId: string; quantity: Quantity; note: string | null; userId: string; submissionId?: string },
): Promise<AddExtraResult> {
  const { bookingId, itemId, userId, note, submissionId } = params;
  const booking = await lockBooking(tx, bookingId);

  // The booking lock makes this check reliable; the unique index is the backstop.
  if (submissionId) {
    const prior = await tx.bookingExtra.findUnique({ where: { submissionId }, select: { bookingId: true, itemId: true, addedById: true, appliedAt: true } });
    if (prior) {
      if (prior.bookingId !== bookingId || prior.itemId !== itemId || prior.addedById !== userId) {
        throw new ActionError("That submission was already used. Reload the page and try again.");
      }
      return { timing: prior.appliedAt ? "NOW" : "LATER", summary: "Already added.", duplicate: true };
    }
  }

  const item = await tx.inventoryItem.findUnique({ where: { id: itemId }, select: { name: true, unit: true, isActive: true, isConsumable: true } });
  if (!item) throw new ActionError("That item no longer exists.", { itemId: "Choose an item." });
  if (!item.isActive) throw new ActionError(`${item.name} is archived, so it can't be added.`, { itemId: "Archived." });
  const quantity = toDecimal(params.quantity);
  if (quantity.lessThanOrEqualTo(0)) throw new ActionError("Enter an amount above zero.", { quantity: "Enter an amount above zero." });
  assertAmountFitsUnit(quantity, item.unit, "quantity");

  const { room, timing } = await timingFor(tx, booking);
  if (timing === "NOW") await placeStock(tx, { bookingId, itemId, isConsumable: item.isConsumable, quantity: quantity.toString(), note, userId, room });

  const extra = await tx.bookingExtra.create({
    data: { bookingId, itemId, quantity: quantity.toString(), note, addedById: userId, submissionId, appliedAt: timing === "NOW" ? new Date() : null },
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
    duplicate: false,
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

/**
 * Places a waiting extra now, through the same path as adding one. Only when the room is set up for the guest
 * (in-house, or Ready and this is its next arrival); otherwise it keeps waiting for the prep.
 */
export async function applyExtra(tx: Tx, params: { extraId: string; userId: string }): Promise<{ summary: string }> {
  const extra = await tx.bookingExtra.findUnique({ where: { id: params.extraId }, select: { bookingId: true } });
  if (!extra) throw new ActionError("That extra was removed.");
  const booking = await lockBooking(tx, extra.bookingId);

  // Re-read under the locks: a prep or another apply that ran first has already placed it.
  const current = await tx.bookingExtra.findUnique({
    where: { id: params.extraId },
    select: { itemId: true, quantity: true, note: true, appliedAt: true, item: { select: { name: true, unit: true, isConsumable: true, isActive: true } } },
  });
  if (!current) throw new ActionError("That extra was removed.");
  if (current.appliedAt) throw new ActionError("That extra is already in the room.");
  if (!current.item.isActive) throw new ActionError(`${current.item.name} is archived, so it can't be placed.`);

  const { room, timing } = await timingFor(tx, booking);
  if (timing !== "NOW") {
    throw new ActionError(`${room?.name ?? "The room"} isn't ready for this guest yet. The extra will be placed when the room is prepared.`);
  }
  await placeStock(tx, {
    bookingId: extra.bookingId,
    itemId: current.itemId,
    isConsumable: current.item.isConsumable,
    quantity: current.quantity.toString(),
    note: current.note,
    userId: params.userId,
    room,
  });
  await tx.bookingExtra.update({ where: { id: params.extraId }, data: { appliedAt: new Date() } });
  const amount = formatQuantityWithUnit(current.quantity.toString(), current.item.unit);
  await logActivity(tx, {
    userId: params.userId,
    action: "booking.extraApplied",
    entityType: "Booking",
    entityId: extra.bookingId,
    details: { extraId: params.extraId, item: current.item.name, amount: current.quantity.toString(), unit: current.item.unit, room: room?.name },
  });
  return { summary: `${amount} of ${current.item.name} ${current.item.isConsumable ? "recorded as used" : `placed in ${room?.name}`}.` };
}
