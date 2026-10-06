import type { Prisma } from "@/generated/prisma/client";
import type { BookingSource, BookingStatus } from "@/generated/prisma/enums";
import { parseDateOnly, addDays } from "./dates";

export const BOOKING_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"];
export const BOOKING_SOURCES: BookingSource[] = ["WEBSITE", "PHONE", "WALK_IN", "OTHER"];

export const bookingListSelect = {
  id: true,
  bookingNumber: true,
  status: true,
  source: true,
  checkIn: true,
  checkOut: true,
  adults: true,
  children: true,
  totalPriceNpr: true,
  createdAt: true,
  guest: { select: { id: true, name: true, phone: true, email: true } },
  roomType: { select: { name: true } },
  room: { select: { name: true } },
} satisfies Prisma.BookingSelect;

export type BookingFilters = {
  q?: string;
  status?: BookingStatus;
  source?: BookingSource;
  roomTypeId?: string;
  /** Stays that overlap [from, to] (inclusive days). */
  from?: string;
  to?: string;
};

/** Reads filters from URL params, ignoring anything invalid. */
export function parseBookingFilters(sp: Record<string, string | string[] | undefined>): BookingFilters {
  const one = (key: string) => {
    const v = sp[key];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const status = one("status");
  const source = one("source");
  const from = one("from");
  const to = one("to");
  return {
    q: one("q")?.slice(0, 100),
    status: BOOKING_STATUSES.find((s) => s === status),
    source: BOOKING_SOURCES.find((s) => s === source),
    roomTypeId: one("roomType")?.slice(0, 64),
    from: from && parseDateOnly(from) ? from : undefined,
    to: to && parseDateOnly(to) ? to : undefined,
  };
}

export function buildBookingWhere(filters: BookingFilters): Prisma.BookingWhereInput {
  const and: Prisma.BookingWhereInput[] = [];
  if (filters.status) and.push({ status: filters.status });
  if (filters.source) and.push({ source: filters.source });
  if (filters.roomTypeId) and.push({ roomTypeId: filters.roomTypeId });
  const from = filters.from ? parseDateOnly(filters.from) : null;
  const to = filters.to ? parseDateOnly(filters.to) : null;
  // A stay occupies [checkIn, checkOut); it overlaps days from..to when it starts by `to` and ends after `from`.
  if (from) and.push({ checkOut: { gt: from } });
  if (to) and.push({ checkIn: { lt: addDays(to, 1) } });
  if (filters.q) {
    const q = filters.q;
    const digits = q.replace(/\D/g, "");
    and.push({
      OR: [
        { bookingNumber: { contains: q, mode: "insensitive" } },
        { guest: { name: { contains: q, mode: "insensitive" } } },
        { guest: { email: { contains: q, mode: "insensitive" } } },
        ...(digits.length >= 4 ? [{ guest: { phone: { contains: digits } } }] : []),
      ],
    });
  }
  return and.length ? { AND: and } : {};
}
