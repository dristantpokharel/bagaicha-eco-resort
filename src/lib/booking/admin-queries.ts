import type { Prisma } from "@/generated/prisma/client";
import type { BookingSource } from "@/generated/prisma/enums";
import { parseDateOnly, addDays } from "./dates";
import type { ReservationStatus } from "./reservation-status";

export const RESERVATION_STATUSES: ReservationStatus[] = ["PENDING", "PARTIALLY_CONFIRMED", "CONFIRMED", "COMPLETED", "CANCELLED"];
export const BOOKING_SOURCES: BookingSource[] = ["WEBSITE", "PHONE", "WALK_IN", "OTHER"];

/** What the reservation list and dashboard need: the reservation and a short summary of each room line. */
export const reservationListSelect = {
  id: true,
  reference: true,
  source: true,
  checkIn: true,
  checkOut: true,
  totalPriceNpr: true,
  createdAt: true,
  guest: { select: { id: true, name: true, phone: true, email: true } },
  bookings: {
    select: { id: true, status: true, adults: true, children: true, roomType: { select: { name: true } }, room: { select: { name: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.ReservationSelect;

export type ReservationFilters = {
  q?: string;
  status?: ReservationStatus;
  source?: BookingSource;
  roomTypeId?: string;
  /** Stays that overlap [from, to] (inclusive days). */
  from?: string;
  to?: string;
};

/** Reads filters from URL params, ignoring anything invalid. */
export function parseReservationFilters(sp: Record<string, string | string[] | undefined>): ReservationFilters {
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
    status: RESERVATION_STATUSES.find((s) => s === status),
    source: BOOKING_SOURCES.find((s) => s === source),
    roomTypeId: one("roomType")?.slice(0, 64),
    from: from && parseDateOnly(from) ? from : undefined,
    to: to && parseDateOnly(to) ? to : undefined,
  };
}

const CONFIRMED_OR_LATER = ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] as const;

/**
 * The database form of deriveReservationStatus (reservation-status.ts): the same five statuses, as a filter on a
 * reservation's room lines. A DB test keeps the two in step.
 */
export function reservationStatusWhere(status: ReservationStatus): Prisma.ReservationWhereInput {
  const completed: Prisma.ReservationWhereInput = {
    bookings: { every: { status: { in: ["CHECKED_OUT", "CANCELLED"] } }, some: { status: "CHECKED_OUT" } },
  };
  switch (status) {
    case "CANCELLED":
      return { bookings: { every: { status: "CANCELLED" } } };
    case "COMPLETED":
      return completed;
    case "PENDING":
      return { bookings: { some: { status: "PENDING" }, none: { status: { in: [...CONFIRMED_OR_LATER] } } } };
    case "CONFIRMED":
      return {
        bookings: { every: { status: { in: [...CONFIRMED_OR_LATER] } }, some: { status: { in: ["CONFIRMED", "CHECKED_IN"] } } },
      };
    case "PARTIALLY_CONFIRMED":
      return {
        AND: [
          { bookings: { some: { status: { in: [...CONFIRMED_OR_LATER] } } } },
          { OR: [{ bookings: { some: { status: "PENDING" } } }, { bookings: { some: { status: "CANCELLED" } } }] },
          { NOT: completed },
        ],
      };
  }
}

export function buildReservationWhere(filters: ReservationFilters): Prisma.ReservationWhereInput {
  const and: Prisma.ReservationWhereInput[] = [];
  if (filters.status) and.push(reservationStatusWhere(filters.status));
  if (filters.source) and.push({ source: filters.source });
  if (filters.roomTypeId) and.push({ bookings: { some: { roomTypeId: filters.roomTypeId } } });
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
        { reference: { contains: q, mode: "insensitive" } },
        { guest: { name: { contains: q, mode: "insensitive" } } },
        { guest: { email: { contains: q, mode: "insensitive" } } },
        ...(digits.length >= 4 ? [{ guest: { phone: { contains: digits } } }] : []),
      ],
    });
  }
  return and.length ? { AND: and } : {};
}
