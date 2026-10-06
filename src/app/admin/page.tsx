import Link from "next/link";
import { db } from "@/lib/db";
import { can, requirePageUser, ROLE_LABELS } from "@/lib/auth";
import { addDays, formatStayDate, nightsBetween } from "@/lib/booking/dates";
import { todayInResort } from "@/lib/dates";
import { PageHeader } from "@/components/admin/page-header";
import { ContactPhone } from "@/components/admin/contact-phone";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Dashboard" };

const UPCOMING_DAYS = 14;

const guestSelect = { select: { id: true, name: true, phone: true } } as const;
const stayInclude = {
  guest: guestSelect,
  roomType: { select: { name: true } },
  room: { select: { name: true } },
} as const;

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
  const today = todayInResort();
  const now = new Date();

  const [arrivals, departures, pending, pendingCount, upcoming, newEnquiries] = canBookings
    ? await Promise.all([
        db.booking.findMany({ where: { status: "CONFIRMED", checkIn: today }, include: stayInclude, orderBy: { createdAt: "asc" } }),
        db.booking.findMany({ where: { status: "CHECKED_IN", checkOut: today }, include: stayInclude, orderBy: { createdAt: "asc" } }),
        db.booking.findMany({ where: { status: "PENDING" }, include: stayInclude, orderBy: { createdAt: "asc" }, take: 10 }),
        db.booking.count({ where: { status: "PENDING" } }),
        db.booking.findMany({
          where: { status: "CONFIRMED", checkIn: { gt: today, lte: addDays(today, UPCOMING_DAYS) } },
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
            {arrivals.map((b) => (
              <Row key={b.id} id={b.id} number={b.bookingNumber} guest={b.guest} detail={`${b.roomType.name}${b.room ? `, ${b.room.name}` : ""} · ${b.adults + b.children} guest${b.adults + b.children === 1 ? "" : "s"} · ${nightsBetween(b.checkIn, b.checkOut)} night${nightsBetween(b.checkIn, b.checkOut) === 1 ? "" : "s"}`} />
            ))}
          </Widget>

          <Widget title="Today's departures" count={departures.length} empty="No departures expected today.">
            {departures.map((b) => (
              <Row key={b.id} id={b.id} number={b.bookingNumber} guest={b.guest} detail={`${b.roomType.name}${b.room ? `, ${b.room.name}` : ""}`} />
            ))}
          </Widget>

          <Widget
            title="Pending requests"
            count={pendingCount}
            empty="No requests waiting."
            footer={pendingCount > pending.length ? <Link href="/admin/bookings?status=PENDING" className="text-forest underline underline-offset-4">See all {pendingCount} pending requests</Link> : undefined}
          >
            {pending.map((b) => (
              <Row
                key={b.id}
                id={b.id}
                number={b.bookingNumber}
                guest={b.guest}
                detail={`${formatStayDate(b.checkIn)} to ${formatStayDate(b.checkOut)} · ${b.roomType.name}`}
                note={`Waiting ${waiting(b.createdAt, now)}`}
              />
            ))}
          </Widget>

          <Widget title={`Confirmed, next ${UPCOMING_DAYS} days`} count={upcoming.length} empty="Nothing confirmed in the coming days.">
            {upcoming.map((b) => (
              <Row key={b.id} id={b.id} number={b.bookingNumber} guest={b.guest} detail={`${formatStayDate(b.checkIn)} to ${formatStayDate(b.checkOut)} · ${b.roomType.name}${b.room ? `, ${b.room.name}` : ""}`} />
            ))}
          </Widget>
        </div>
      ) : null}

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
        {canEnquiries && (
          <Link href="/admin/enquiries?status=NEW" className={buttonClasses({ variant: "secondary" })}>
            New enquiries ({newEnquiries})
          </Link>
        )}
      </div>
      <p className="mt-6 text-sm text-charcoal-light">Low-stock items will appear here in Phase 4.</p>
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
