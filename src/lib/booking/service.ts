import type { Prisma } from "@/generated/prisma/client";
import { ActionError } from "@/lib/actions";
import { assertRoomAssignable, findFreeRooms } from "./availability";
import { nextBookingNumber } from "./booking-number";
import { findOrCreateGuest, type GuestInput } from "./guests";
import { quoteReservation, validateSplit, type RoomLine, type RoomTypeForBooking } from "./multi-room";
import { nightsBetween } from "./dates";

type Tx = Prisma.TransactionClient;

export type NewReservationInput = {
  /** Room types as loaded from the database by the caller (prices and limits are never taken from the browser). */
  roomTypes: ReadonlyMap<string, RoomTypeForBooking>;
  /** One entry per room. Staff may name the physical room, which makes that line CONFIRMED. */
  lines: (RoomLine & { roomId?: string | null })[];
  checkIn: Date;
  checkOut: Date;
  guest: GuestInput;
  source: "WEBSITE" | "PHONE" | "WALK_IN" | "OTHER";
  specialRequests?: string | null;
  internalNotes?: string | null;
  createdById?: string | null;
  /** Public requests: refuse unless enough distinct rooms of every type are free for the whole stay. */
  requireAvailability?: boolean;
  /** Most rooms allowed; null = no limit (staff). Defaults to the public limit. */
  maxRooms?: number | null;
};

/**
 * Creates a reservation and all its room lines inside the caller's transaction: all or nothing.
 * Each line's price is computed from the room type row passed in and snapshotted on the line.
 * Throws an ActionError (nothing saved) if any line doesn't fit its room, the room limit is exceeded,
 * or fewer distinct rooms are free than requested.
 */
export async function createReservationRecord(tx: Tx, input: NewReservationInput) {
  const { roomTypes, lines, checkIn, checkOut } = input;

  // The whole party is whatever the lines add up to here; the caller checks it against the search party.
  const party = lines.reduce((p, l) => ({ adults: p.adults + l.adults, children: p.children + l.children }), { adults: 0, children: 0 });
  const options = input.maxRooms === undefined ? {} : { maxRooms: input.maxRooms };
  const split = validateSplit(lines, roomTypes, party, options);
  if (!split.ok) {
    throw new ActionError(Object.values(split.lineErrors)[0] ?? split.errors[0] ?? "Please check your room selection.");
  }

  if (input.requireAvailability) {
    const wanted = new Map<string, number>();
    for (const l of lines) wanted.set(l.roomTypeId, (wanted.get(l.roomTypeId) ?? 0) + 1);
    for (const [roomTypeId, need] of wanted) {
      const free = await findFreeRooms(tx, roomTypeId, checkIn, checkOut);
      if (free.length >= need) continue;
      const name = roomTypes.get(roomTypeId)!.name;
      throw new ActionError(
        free.length === 0
          ? `Sorry, ${name} was just taken for these dates. Please choose other dates or another room.`
          : `Sorry, only ${free.length} ${name} ${free.length === 1 ? "room is" : "rooms are"} still free for these dates, and you asked for ${need}. Please adjust your selection.`,
      );
    }
  }

  // Rooms named by staff: each must be assignable, and no room twice. Locked in a fixed order to avoid deadlocks.
  const named = lines.flatMap((l) => (l.roomId ? [{ roomId: l.roomId, roomTypeId: l.roomTypeId }] : []));
  if (new Set(named.map((n) => n.roomId)).size !== named.length) {
    throw new ActionError("The same room can't be used for two lines. Choose a different room for each.");
  }
  for (const n of [...named].sort((a, b) => a.roomId.localeCompare(b.roomId))) {
    await assertRoomAssignable(tx, { ...n, checkIn, checkOut });
  }

  const quote = quoteReservation(lines, roomTypes, nightsBetween(checkIn, checkOut));
  const guest = await findOrCreateGuest(tx, input.guest);
  const reference = await nextBookingNumber(tx);
  const confirmedAt = new Date();

  const reservation = await tx.reservation.create({
    data: {
      reference,
      guestId: guest.id,
      checkIn,
      checkOut,
      source: input.source,
      specialRequests: input.specialRequests || null,
      internalNotes: input.internalNotes || null,
      totalPriceNpr: quote.totalPriceNpr,
      createdById: input.createdById ?? null,
      bookings: {
        create: lines.map((line, i) => ({
          roomTypeId: line.roomTypeId,
          roomId: line.roomId ?? null,
          checkIn,
          checkOut,
          adults: line.adults,
          children: line.children,
          status: line.roomId ? ("CONFIRMED" as const) : ("PENDING" as const),
          confirmedAt: line.roomId ? confirmedAt : null,
          pricePerNightNpr: quote.lines[i].pricePerNightNpr,
          childPricePerNightNpr: quote.lines[i].childPricePerNightNpr,
          totalPriceNpr: quote.lines[i].totalPriceNpr,
        })),
      },
    },
    include: { bookings: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } },
  });
  return { reservation, bookings: reservation.bookings, guest, quote };
}
