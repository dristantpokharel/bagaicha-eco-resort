import type { Prisma } from "@/generated/prisma/client";
import { ActionError } from "@/lib/actions";
import { assertRoomAssignable, findFreeRooms } from "./availability";
import { nextBookingNumber } from "./booking-number";
import { findOrCreateGuest, type GuestInput } from "./guests";
import { computeQuote } from "./pricing";
import { nightsBetween } from "./dates";

type Tx = Prisma.TransactionClient;

export type NewBookingInput = {
  roomType: { id: string; basePriceNpr: number; childPricePerNightNpr: number };
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  guest: GuestInput;
  source: "WEBSITE" | "PHONE" | "WALK_IN" | "OTHER";
  specialRequests?: string | null;
  internalNotes?: string | null;
  createdById?: string | null;
  /** Staff only: assigns this room and creates the booking as CONFIRMED. */
  roomId?: string | null;
  /** Public requests: refuse when no room of the type is free. */
  requireAvailability?: boolean;
};

/**
 * Creates a booking inside the caller's transaction. Prices come from the
 * room type row passed in (loaded server-side by the caller) and are
 * snapshotted on the booking.
 */
export async function createBookingRecord(tx: Tx, input: NewBookingInput) {
  const { roomType, checkIn, checkOut } = input;

  if (input.roomId) {
    await assertRoomAssignable(tx, { roomId: input.roomId, roomTypeId: roomType.id, checkIn, checkOut });
  } else if (input.requireAvailability) {
    const free = await findFreeRooms(tx, roomType.id, checkIn, checkOut);
    if (free.length === 0) {
      throw new ActionError("Sorry, that room type was just taken for these dates. Please choose other dates or another room.");
    }
  }

  const quote = computeQuote({
    nights: nightsBetween(checkIn, checkOut),
    pricePerNightNpr: roomType.basePriceNpr,
    childPricePerNightNpr: roomType.childPricePerNightNpr,
    children: input.children,
  });

  const guest = await findOrCreateGuest(tx, input.guest);
  const bookingNumber = await nextBookingNumber(tx);

  const booking = await tx.booking.create({
    data: {
      bookingNumber,
      guestId: guest.id,
      roomTypeId: roomType.id,
      roomId: input.roomId ?? null,
      checkIn,
      checkOut,
      adults: input.adults,
      children: input.children,
      status: input.roomId ? "CONFIRMED" : "PENDING",
      confirmedAt: input.roomId ? new Date() : null,
      source: input.source,
      pricePerNightNpr: quote.pricePerNightNpr,
      childPricePerNightNpr: quote.childPricePerNightNpr,
      totalPriceNpr: quote.totalPriceNpr,
      specialRequests: input.specialRequests || null,
      internalNotes: input.internalNotes || null,
      createdById: input.createdById ?? null,
    },
  });
  return { booking, guest, quote };
}
