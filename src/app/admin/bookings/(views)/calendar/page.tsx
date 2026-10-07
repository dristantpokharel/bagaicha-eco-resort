import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db";
import { todayInResort } from "@/lib/dates";
import { barColumns, monthDays, parseMonth } from "@/lib/booking/calendar";
import { toDateOnlyString } from "@/lib/booking/dates";
import { BOOKING_STATUS_LABELS } from "@/lib/booking/labels";
import { buttonClasses } from "@/components/ui/button";
import type { BookingStatus } from "@/generated/prisma/enums";

export const metadata = { title: "Booking calendar" };

const LABEL_COL = "10rem";
const DAY_COL = "2.25rem";

const BAR_STYLES: Record<BookingStatus, string> = {
  PENDING: "border-warning bg-warning/15 text-warning",
  CONFIRMED: "border-forest bg-forest text-cream",
  CHECKED_IN: "border-success bg-success text-white",
  CHECKED_OUT: "border-sage-muted bg-sage text-ink",
  CANCELLED: "",
};

type Bar = {
  key: string;
  href?: string;
  label: string;
  title: string;
  start: number;
  end: number;
  className: string;
};

export default async function BookingCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string | string[] }> }) {
  const sp = await searchParams;
  const today = todayInResort();
  const month = parseMonth(Array.isArray(sp.month) ? sp.month[0] : sp.month, today);
  const days = monthDays(month);
  const todayCol = today >= month.start && today < month.end ? days.findIndex((d) => d.getTime() === today.getTime()) + 1 : 0;

  const [roomTypes, bookings, blocks] = await Promise.all([
    db.roomType.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, rooms: { orderBy: { name: "asc" }, select: { id: true, name: true, isActive: true } } },
    }),
    db.booking.findMany({
      where: { status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] }, checkIn: { lt: month.end }, checkOut: { gt: month.start } },
      select: {
        id: true,
        status: true,
        checkIn: true,
        checkOut: true,
        roomId: true,
        roomTypeId: true,
        reservation: { select: { id: true, reference: true, guest: { select: { name: true } }, _count: { select: { bookings: true } } } },
      },
      orderBy: { checkIn: "asc" },
    }),
    db.roomBlock.findMany({
      where: { startDate: { lt: month.end }, endDate: { gt: month.start } },
      select: { id: true, roomId: true, startDate: true, endDate: true, reason: true },
    }),
  ]);

  const bookingBar = (b: (typeof bookings)[number]): Bar | null => {
    const cols = barColumns(b.checkIn, b.checkOut, month);
    if (!cols) return null;
    return {
      key: b.id,
      // Each room has its own bar; clicking opens the whole reservation.
      href: `/admin/bookings/${b.reservation.id}`,
      label: `${b.reservation.guest.name} · ${b.reservation.reference}`,
      title: `${b.reservation.reference}, ${b.reservation.guest.name}${
        b.reservation._count.bookings > 1 ? ` (${b.reservation._count.bookings} rooms)` : ""
      }, ${BOOKING_STATUS_LABELS[b.status]}: ${toDateOnlyString(b.checkIn)} to ${toDateOnlyString(b.checkOut)}`,
      start: cols.start,
      end: cols.end,
      className: BAR_STYLES[b.status],
    };
  };

  const compact = <T,>(items: (T | null)[]) => items.filter((x): x is T => x !== null);

  type Row = { key: string; label: string; sub?: string; bars: Bar[]; muted?: boolean };
  const sections = roomTypes.map((rt) => {
    const rows: Row[] = [];
    for (const room of rt.rooms) {
      const roomBookings = bookings.filter((b) => b.roomId === room.id);
      const roomBlocks = blocks.filter((bl) => bl.roomId === room.id);
      // Archived rooms only appear when they still have something in this month.
      if (!room.isActive && roomBookings.length === 0 && roomBlocks.length === 0) continue;
      rows.push({
        key: room.id,
        label: room.name,
        sub: room.isActive ? undefined : "archived",
        muted: !room.isActive,
        bars: [
          ...compact(roomBookings.map(bookingBar)),
          ...compact(
            roomBlocks.map((bl): Bar | null => {
              const cols = barColumns(bl.startDate, bl.endDate, month);
              return cols
                ? {
                    key: bl.id,
                    label: `Blocked: ${bl.reason}`,
                    title: `Blocked ${toDateOnlyString(bl.startDate)} to ${toDateOnlyString(bl.endDate)}: ${bl.reason}`,
                    start: cols.start,
                    end: cols.end,
                    className: "border-charcoal/30 bg-charcoal/15 text-charcoal bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.08)_4px,rgba(0,0,0,0.08)_8px)]",
                  }
                : null;
            }),
          ),
        ],
      });
    }
    // Requests with no room yet: one row each so overlapping ones stay readable.
    for (const b of bookings.filter((x) => x.roomTypeId === rt.id && !x.roomId)) {
      const bar = bookingBar(b);
      if (bar) rows.push({ key: `p-${b.id}`, label: "Unassigned", sub: "pending request", bars: [bar] });
    }
    return { id: rt.id, name: rt.name, rows };
  });

  const gridCols = `${LABEL_COL} repeat(${month.days}, minmax(${DAY_COL}, 1fr))`;
  const monthLabel = formatInTimeZone(month.start, "UTC", "MMMM yyyy");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl text-forest">{monthLabel}</h2>
        <div className="flex gap-2">
          <Link href={`/admin/bookings/calendar?month=${month.prev}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            ← Previous
          </Link>
          <Link href="/admin/bookings/calendar" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Today
          </Link>
          <Link href={`/admin/bookings/calendar?month=${month.next}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Next →
          </Link>
        </div>
      </div>

      <ul className="flex flex-wrap gap-3 text-xs text-charcoal-light" aria-label="Legend">
        {(["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-5 rounded-sm border ${BAR_STYLES[s]}`} aria-hidden="true" />
            {BOOKING_STATUS_LABELS[s]}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm border border-charcoal/30 bg-charcoal/15" aria-hidden="true" />
          Blocked
        </li>
      </ul>

      {roomTypes.every((rt) => rt.rooms.length === 0) ? (
        <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-8 text-center text-sm text-charcoal-light">
          No rooms yet. Add rooms under Rooms to see them here.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-forest/10 bg-white">
          <div style={{ minWidth: `calc(${LABEL_COL} + ${month.days} * ${DAY_COL})` }}>
            <div className="grid border-b border-forest/10 bg-cream text-center text-xs" style={{ gridTemplateColumns: gridCols }}>
              <div className="sticky left-0 z-20 bg-cream px-3 py-2 text-left font-medium text-charcoal-light">Room</div>
              {days.map((day, i) => (
                <div
                  key={i}
                  className={`py-1 leading-tight ${todayCol === i + 1 ? "bg-forest/10 font-semibold text-forest" : "text-charcoal-light"}`}
                >
                  <span className="block">{formatInTimeZone(day, "UTC", "EEEEE")}</span>
                  <span className="block">{i + 1}</span>
                </div>
              ))}
            </div>

            {sections.map((section) => (
              <section key={section.id} aria-label={section.name}>
                <h3 className="sticky left-0 border-b border-forest/10 bg-sage/40 px-3 py-1 text-xs font-semibold tracking-wide text-forest uppercase">
                  {section.name}
                </h3>
                {section.rows.length === 0 && <p className="px-3 py-2 text-xs text-charcoal-light">No rooms of this type yet.</p>}
                {section.rows.map((row) => (
                  <div key={row.key} className="grid border-b border-forest/10" style={{ gridTemplateColumns: gridCols }}>
                    <div className={`sticky left-0 z-10 bg-white px-3 py-1.5 text-sm ${row.muted ? "text-charcoal-light" : "text-charcoal"}`} style={{ gridColumn: 1, gridRow: 1 }}>
                      {row.label}
                      {row.sub && <span className="block text-[0.6875rem] text-charcoal-light">{row.sub}</span>}
                    </div>
                    {days.map((_, i) => (
                      <div
                        key={i}
                        aria-hidden="true"
                        className={`border-l border-forest/5 ${todayCol === i + 1 ? "bg-forest/5" : ""}`}
                        style={{ gridColumn: i + 2, gridRow: 1 }}
                      />
                    ))}
                    {row.bars.map((bar) => {
                      const classes = `z-[5] m-0.5 flex items-center overflow-hidden rounded-sm border px-1.5 text-xs leading-tight whitespace-nowrap ${bar.className}`;
                      const style = { gridColumn: `${bar.start + 1} / ${bar.end + 1}`, gridRow: 1 };
                      return bar.href ? (
                        <Link key={bar.key} href={bar.href} title={bar.title} aria-label={bar.title} className={`${classes} hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-forest`} style={style}>
                          <span className="truncate">{bar.label}</span>
                        </Link>
                      ) : (
                        <div key={bar.key} title={bar.title} className={classes} style={style}>
                          <span className="truncate">{bar.label}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-charcoal-light">Each bar covers the nights of a stay; the check-out day is free for the next guest.</p>
    </div>
  );
}
