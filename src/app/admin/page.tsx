import Link from "next/link";
import { db } from "@/lib/db";
import { can, requirePageUser, ROLE_LABELS } from "@/lib/auth";
import { addDays, formatStayDate, nightsBetween } from "@/lib/booking/dates";
import { todayInResort } from "@/lib/dates";
import type { Prisma } from "@/generated/prisma/client";
import type { BookingStatus } from "@/generated/prisma/enums";
import { summariseRooms } from "@/lib/booking/multi-room";
import { PageHeader } from "@/components/admin/page-header";
import { ContactPhone } from "@/components/admin/contact-phone";
import { StockBadge } from "@/components/admin/stock-badge";
import { buttonClasses } from "@/components/ui/button";
import { listLowStockItems } from "@/lib/inventory/queries";
import { formatQuantityWithUnit } from "@/lib/inventory/stock";
import { listPlaceholders } from "@/lib/content/placeholder-report";

export const metadata = { title: "Dashboard" };

const UPCOMING_DAYS = 14;
const LOW_STOCK_SHOWN = 10;

const stayInclude = {
  guest: { select: { id: true, name: true, phone: true } },
  bookings: {
    select: { status: true, adults: true, children: true, roomType: { select: { name: true } }, room: { select: { name: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.ReservationInclude;

type Stay = { bookings: { status: BookingStatus; adults: number; children: number; roomType: { name: string }; room: { name: string } | null }[] };

/** "2× Deluxe Room (201, 202), 1× Family Room"; only rooms in the given states, so cancelled ones don't show. */
function roomsDetail(r: Stay, statuses: BookingStatus[]) {
  const lines = r.bookings.filter((b) => statuses.includes(b.status));
  const rooms = lines.flatMap((b) => (b.room ? [b.room.name] : []));
  return `${summariseRooms(lines.map((b) => b.roomType.name))}${rooms.length ? ` (${rooms.join(", ")})` : ""}`;
}

const guestCount = (r: Stay, statuses: BookingStatus[]) =>
  r.bookings.filter((b) => statuses.includes(b.status)).reduce((n, b) => n + b.adults + b.children, 0);

/** "3 hours", "2 days": how long a request has been waiting. */
function waiting(since: Date, now: Date) {
  const hours = Math.floor((now.getTime() - since.getTime()) / 3_600_000);
  if (hours < 1) return "under an hour";
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  return `${Math.floor(hours / 24)} days`;
}

export default async function AdminDashboardPage() {
  const user = await requirePageUser();
  const canBookings = can(user.role, "bookings.manage");
  const canEnquiries = can(user.role, "enquiries.manage");
  const canInventory = can(user.role, "inventory.recordMovements");
  const today = todayInResort();
  const now = new Date();
  const lowStock = canInventory ? await listLowStockItems() : [];
  const placeholders = can(user.role, "content.manage") ? await listPlaceholders() : null;

  // Reservations, not rooms: a booking of three rooms is one arrival, one request.
  const [arrivals, departures, pending, pendingCount, upcoming, newEnquiries] = canBookings
    ? await Promise.all([
        db.reservation.findMany({ where: { checkIn: today, bookings: { some: { status: "CONFIRMED" } } }, include: stayInclude, orderBy: { createdAt: "asc" } }),
        db.reservation.findMany({ where: { checkOut: today, bookings: { some: { status: "CHECKED_IN" } } }, include: stayInclude, orderBy: { createdAt: "asc" } }),
        db.reservation.findMany({ where: { bookings: { some: { status: "PENDING" } } }, include: stayInclude, orderBy: { createdAt: "asc" }, take: 10 }),
        db.reservation.count({ where: { bookings: { some: { status: "PENDING" } } } }),
        db.reservation.findMany({
          where: { checkIn: { gt: today, lte: addDays(today, UPCOMING_DAYS) }, bookings: { some: { status: "CONFIRMED" } } },
          include: stayInclude,
          orderBy: [{ checkIn: "asc" }, { createdAt: "asc" }],
          take: 20,
        }),
        canEnquiries ? db.enquiry.count({ where: { status: "NEW" } }) : Promise.resolve(0),
      ])
    : [[], [], [], 0, [], 0];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${formatStayDate(today)} · Signed in as ${user.name} (${ROLE_LABELS[user.role]})`}
      />

      {canBookings ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Widget title="Today's arrivals" count={arrivals.length} empty="No arrivals expected today.">
            {arrivals.map((r) => (
              <Row
                key={r.id}
                id={r.id}
                number={r.reference}
                guest={r.guest}
                detail={`${roomsDetail(r, ["CONFIRMED"])} · ${guestCount(r, ["CONFIRMED"])} guest${guestCount(r, ["CONFIRMED"]) === 1 ? "" : "s"} · ${nightsBetween(r.checkIn, r.checkOut)} night${nightsBetween(r.checkIn, r.checkOut) === 1 ? "" : "s"}`}
              />
            ))}
          </Widget>

          <Widget title="Today's departures" count={departures.length} empty="No departures expected today.">
            {departures.map((r) => (
              <Row key={r.id} id={r.id} number={r.reference} guest={r.guest} detail={roomsDetail(r, ["CHECKED_IN"])} />
            ))}
          </Widget>

          <Widget
            title="Pending requests"
            count={pendingCount}
            empty="No requests waiting."
            footer={pendingCount > pending.length ? <Link href="/admin/bookings?status=PENDING" className="text-forest underline underline-offset-4">See all {pendingCount} pending requests</Link> : undefined}
          >
            {pending.map((r) => (
              <Row
                key={r.id}
                id={r.id}
                number={r.reference}
                guest={r.guest}
                detail={`${formatStayDate(r.checkIn)} to ${formatStayDate(r.checkOut)} · ${roomsDetail(r, ["PENDING"])}`}
                note={`Waiting ${waiting(r.createdAt, now)}`}
              />
            ))}
          </Widget>

          <Widget title={`Confirmed, next ${UPCOMING_DAYS} days`} count={upcoming.length} empty="Nothing confirmed in the coming days.">
            {upcoming.map((r) => (
              <Row key={r.id} id={r.id} number={r.reference} guest={r.guest} detail={`${formatStayDate(r.checkIn)} to ${formatStayDate(r.checkOut)} · ${roomsDetail(r, ["CONFIRMED"])}`} />
            ))}
          </Widget>
        </div>
      ) : null}

      {canInventory && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Widget
            title="Low stock"
            count={lowStock.length}
            empty="Nothing is running low."
            footer={
              <Link href="/admin/inventory?low=1" className="text-forest underline underline-offset-4">
                {lowStock.length > LOW_STOCK_SHOWN ? `See all ${lowStock.length} low-stock items` : "Open inventory"}
              </Link>
            }
          >
            {lowStock.slice(0, LOW_STOCK_SHOWN).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/admin/inventory/${item.id}`} className="font-medium text-forest underline-offset-4 hover:underline">
                  {item.name}
                </Link>
                <span className="flex items-center gap-2">
                  <StockBadge item={item} />
                  <span className="whitespace-nowrap tabular-nums">
                    {formatQuantityWithUnit(item.quantity, item.unit)}
                  </span>
                </span>
              </li>
            ))}
          </Widget>
        </div>
      )}

      {placeholders && (
        <div className="mt-6">
          <Widget
            title="Placeholders (must be replaced before launch)"
            count={placeholders.length}
            empty="No placeholder content is left."
            footer={
              placeholders.length > 0
                ? "Placeholders show with a badge while developing and are hidden on the live site."
                : undefined
            }
          >
            {placeholders.map((p, i) => (
              <li key={`${p.section}-${p.title}-${i}`} className="py-2 text-sm">
                <Link href={p.href} className="font-medium text-forest underline-offset-4 hover:underline">
                  {p.title}
                </Link>
                <span className="text-charcoal-light">
                  {" "}
                  · {p.section} · {p.fields.join(", ")}
                </span>
              </li>
            ))}
          </Widget>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {canBookings && (
          <>
            <Link href="/admin/bookings/new" className={buttonClasses()}>
              New booking
            </Link>
            <Link href="/admin/bookings/calendar" className={buttonClasses({ variant: "secondary" })}>
              Calendar
            </Link>
          </>
        )}
        {canInventory && (
          <Link href="/admin/inventory/record" className={buttonClasses({ variant: "secondary" })}>
            Record stock
          </Link>
        )}
        {canEnquiries && (
          <Link href="/admin/enquiries?status=NEW" className={buttonClasses({ variant: "secondary" })}>
            New enquiries ({newEnquiries})
          </Link>
        )}
      </div>
    </>
  );
}

function Widget({
  title,
  count,
  empty,
  children,
  footer,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-forest/10 bg-white p-5" aria-label={title}>
      <h2 className="mb-3 flex items-baseline justify-between font-display text-lg text-forest">
        {title}
        <span className="text-sm font-normal text-charcoal-light">{count}</span>
      </h2>
      {count === 0 ? <p className="text-sm text-charcoal-light">{empty}</p> : <ul className="divide-y divide-forest/10">{children}</ul>}
      {footer && <p className="mt-3 text-sm">{footer}</p>}
    </section>
  );
}

function Row({
  id,
  number,
  guest,
  detail,
  note,
}: {
  id: string;
  number: string;
  guest: { id: string; name: string; phone: string | null };
  detail: string;
  note?: string;
}) {
  return (
    <li className="py-2.5 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <Link href={`/admin/bookings/${id}`} className="font-medium text-forest underline-offset-2 hover:underline">
          {guest.name}
        </Link>
        <span className="text-xs text-charcoal-light">{number}</span>
      </div>
      <p className="text-charcoal-light">{detail}</p>
      {note && <p className="text-xs text-warning">{note}</p>}
      {guest.phone && (
        <p className="text-xs">
          <ContactPhone phone={guest.phone} />
        </p>
      )}
    </li>
  );
}
