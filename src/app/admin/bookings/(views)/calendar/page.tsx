import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db";
import { can, requirePageUser } from "@/lib/auth";
import { todayInResort } from "@/lib/dates";
import { parseTapeRange } from "@/lib/booking/calendar";
import { toDateOnlyString } from "@/lib/booking/dates";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/labels";
import type { TapeBar, TapeData, TapeReservation } from "@/lib/booking/tape";
import { buttonClasses } from "@/components/ui/button";
import type { BookingStatus } from "@/generated/prisma/enums";
import { TapeChart } from "./tape-chart";

export const metadata = { title: "Booking calendar" };

const LEGEND_STYLES: Record<Exclude<BookingStatus, "CANCELLED">, string> = {
  PENDING: "border-warning bg-warning/15",
  CONFIRMED: "border-forest bg-forest",
  CHECKED_IN: "border-success bg-success",
  CHECKED_OUT: "border-sage-muted bg-sage",
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BookingCalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageUser();
  const sp = await searchParams;
  const today = todayInResort();
  const range = parseTapeRange({ view: one(sp.view), from: one(sp.from), month: one(sp.month) }, today);

  const [roomTypes, bookings, blocks] = await Promise.all([
    db.roomType.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, rooms: { orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true, status: true } } },
    }),
    db.booking.findMany({
      where: { status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] }, checkIn: { lt: range.end }, checkOut: { gt: range.start } },
      select: {
        id: true,
        status: true,
        checkIn: true,
        checkOut: true,
        roomId: true,
        roomTypeId: true,
        reservation: {
          select: {
            id: true,
            reference: true,
            guestName: true,
            guestEmail: true,
            // Every room of the reservation, for the price impact of a date change.
            bookings: {
              select: { id: true, status: true, roomId: true, roomTypeId: true, children: true, pricePerNightNpr: true, childPricePerNightNpr: true, totalPriceNpr: true },
            },
          },
        },
      },
      orderBy: { checkIn: "asc" },
    }),
    db.roomBlock.findMany({
      where: { startDate: { lt: range.end }, endDate: { gt: range.start } },
      select: { id: true, roomId: true, startDate: true, endDate: true, reason: true },
    }),
  ]);

  const reservations: Record<string, TapeReservation> = {};
  const bars: TapeBar[] = bookings.map((b) => {
    const r = b.reservation;
    reservations[r.id] ??= { id: r.id, reference: r.reference, guestName: r.guestName, hasEmail: !!r.guestEmail, lines: r.bookings };
    return {
      id: b.id,
      kind: "booking",
      reservationId: r.id,
      reference: r.reference,
      title: r.guestName,
      status: b.status,
      roomId: b.roomId,
      roomTypeId: b.roomTypeId,
      checkIn: toDateOnlyString(b.checkIn),
      checkOut: toDateOnlyString(b.checkOut),
    };
  });
  for (const bl of blocks) {
    bars.push({
      id: bl.id,
      kind: "block",
      reservationId: null,
      reference: null,
      title: bl.reason,
      status: null,
      roomId: bl.roomId,
      roomTypeId: null,
      checkIn: toDateOnlyString(bl.startDate),
      checkOut: toDateOnlyString(bl.endDate),
    });
  }
  const data: TapeData = { types: roomTypes.map((t) => ({ id: t.id, name: t.name, rooms: t.rooms.map((r) => ({ ...r, typeId: t.id })) })), bars, reservations, today: toDateOnlyString(today) };

  const label =
    range.view === "month"
      ? formatInTimeZone(range.start, "UTC", "MMMM yyyy")
      : `${formatInTimeZone(range.start, "UTC", "d MMM")} to ${formatInTimeZone(new Date(range.end.getTime() - 86_400_000), "UTC", "d MMM yyyy")}`;
  const href = (query: string) => `/admin/bookings/calendar?${query}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl text-forest">{label}</h2>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1" role="group" aria-label="View">
            <Link
              href={href(range.view === "2w" ? range.here : range.other)}
              aria-current={range.view === "2w" ? "true" : undefined}
              className={buttonClasses({ variant: range.view === "2w" ? "primary" : "secondary", size: "sm", className: "min-h-11 sm:min-h-8" })}
            >
              2 weeks
            </Link>
            <Link
              href={href(range.view === "month" ? range.here : range.other)}
              aria-current={range.view === "month" ? "true" : undefined}
              className={buttonClasses({ variant: range.view === "month" ? "primary" : "secondary", size: "sm", className: "min-h-11 sm:min-h-8" })}
            >
              Month
            </Link>
          </div>
          <Link href={href(range.prev)} className={buttonClasses({ variant: "secondary", size: "sm", className: "min-h-11 sm:min-h-8" })}>
            ← Previous
          </Link>
          <Link href={href(range.here)} className={buttonClasses({ variant: "secondary", size: "sm", className: "min-h-11 sm:min-h-8" })}>
            Today
          </Link>
          <Link href={href(range.next)} className={buttonClasses({ variant: "secondary", size: "sm", className: "min-h-11 sm:min-h-8" })}>
            Next →
          </Link>
        </div>
      </div>

      <ul className="flex flex-wrap gap-3 text-xs text-charcoal-light" aria-label="Legend">
        {(Object.keys(LEGEND_STYLES) as (keyof typeof LEGEND_STYLES)[]).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-5 rounded-sm border ${LEGEND_STYLES[s]}`} aria-hidden="true" />
            {BOOKING_STATUS_LABELS[s]}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border border-charcoal/30 bg-charcoal/15" aria-hidden="true" />
          Blocked
        </li>
      </ul>

      {/* Remount on navigation so a drag or an open dialog never carries over to another period. */}
      <TapeChart key={`${range.view}-${toDateOnlyString(range.start)}`} data={data} start={toDateOnlyString(range.start)} days={range.days} canBlock={can(user.role, "rooms.blockDates")} />
      <p className="text-xs text-charcoal-light">Each bar covers the nights of a stay; the check-out day is free for the next guest.</p>
    </div>
  );
}
