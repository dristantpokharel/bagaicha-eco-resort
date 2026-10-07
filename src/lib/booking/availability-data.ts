import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { BOOKING } from "@/config/booking";
import { db } from "@/lib/db";
import { todayInResort } from "@/lib/dates";
import { addDays } from "./dates";
import { OCCUPYING_STATUSES } from "./availability";
import {
  buildAvailabilityPayload,
  buildIndex,
  type AvailabilityIndex,
  type AvailabilityPayload,
  type RoomTypeInfo,
} from "./availability-map";

/** Tag on the cached public calendar data. Bust it with revalidateAvailability(). */
export const AVAILABILITY_TAG = "availability";
const CACHE_SECONDS = 60;

/** Call after anything that changes which rooms are taken: confirm, cancel, check-out, edit, blocks, room archive. */
export function revalidateAvailability() {
  revalidateTag(AVAILABILITY_TAG, { expire: 0 });
}

/** Active, bookable room types and an index of occupied intervals overlapping [from, to). */
export async function loadAvailability(from: Date, to: Date): Promise<{ types: RoomTypeInfo[]; index: AvailabilityIndex }> {
  const [types, rooms] = await Promise.all([
    db.roomType.findMany({
      where: { isActive: true, rooms: { some: { isActive: true } } },
      select: { id: true, slug: true, name: true, maxGuests: true, maxAdults: true, maxChildren: true, basePriceNpr: true, childPricePerNightNpr: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    db.room.findMany({ where: { isActive: true, roomType: { isActive: true } }, select: { id: true, roomTypeId: true } }),
  ]);
  const roomIds = rooms.map((r) => r.id);
  const [bookings, blocks] = await Promise.all([
    db.booking.findMany({
      where: { roomId: { in: roomIds }, status: { in: [...OCCUPYING_STATUSES] }, checkIn: { lt: to }, checkOut: { gt: from } },
      select: { roomId: true, checkIn: true, checkOut: true },
    }),
    db.roomBlock.findMany({
      where: { roomId: { in: roomIds }, startDate: { lt: to }, endDate: { gt: from } },
      select: { roomId: true, startDate: true, endDate: true },
    }),
  ]);
  const busy = [
    ...bookings.flatMap((b) => (b.roomId ? [{ roomId: b.roomId, start: b.checkIn, end: b.checkOut }] : [])),
    ...blocks.map((b) => ({ roomId: b.roomId, start: b.startDate, end: b.endDate })),
  ];
  return { types, index: buildIndex(rooms, busy) };
}

/** Sold-out nights per room type for the next 365 nights. Cached for a minute. */
export const getAvailabilityPayload = unstable_cache(
  async (): Promise<AvailabilityPayload> => {
    const from = todayInResort();
    const days = BOOKING.maxDaysAhead;
    const { types, index } = await loadAvailability(from, addDays(from, days));
    return buildAvailabilityPayload(types, index, from, days);
  },
  ["availability-payload"],
  { tags: [AVAILABILITY_TAG], revalidate: CACHE_SECONDS },
);
