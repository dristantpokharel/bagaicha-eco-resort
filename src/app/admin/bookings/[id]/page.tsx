import Link from "next/link";
import { notFound } from "next/navigation";
import { BOOKING } from "@/config/booking";
import { db } from "@/lib/db";
import { loadStayTerms } from "@/lib/content/stay-terms";
import { can, requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { formatDateTime, todayInResort } from "@/lib/dates";
import { findFreeRooms } from "@/lib/booking/availability";
import { formatStayDate, nightsBetween, toDateOnlyString } from "@/lib/booking/dates";
import { BOOKING_SOURCE_LABELS } from "@/lib/booking/labels";
import { computeQuote, quoteLines } from "@/lib/booking/pricing";
import { editableFlags } from "@/lib/booking/status";
import { formatNpr } from "@/lib/money";
import { ContactPhone } from "@/components/admin/contact-phone";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { FormMessage } from "@/components/ui/form";
import { BookingActions } from "./booking-actions";
import { BookingEditForm } from "./booking-edit-form";

export const metadata = { title: "Booking" };

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const user = await requirePagePermission(ADMIN_SECTIONS.bookings.permission);
  const { id } = await params;
  const sp = await searchParams;

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      guest: true,
      roomType: true,
      room: true,
      createdBy: { select: { name: true } },
    },
  });
  if (!booking) notFound();
  const terms = await loadStayTerms();

  const flags = editableFlags(booking.status);
  const canSeeLog = can(user.role, "activityLog.view");
  const needsFreeRooms = booking.status === "PENDING" || (booking.status === "CONFIRMED" && flags.room);

  const [freeRooms, roomTypes, history] = await Promise.all([
    needsFreeRooms
      ? findFreeRooms(db, booking.roomTypeId, booking.checkIn, booking.checkOut, booking.id)
      : Promise.resolve([]),
    flags.roomType ? db.roomType.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
    canSeeLog
      ? db.activityLog.findMany({
          where: { entityType: "Booking", entityId: booking.id },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, action: true, createdAt: true, user: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  // The current room stays selectable even though it overlaps "itself".
  const editRooms =
    booking.room && !freeRooms.some((r) => r.id === booking.room!.id)
      ? [{ id: booking.room.id, name: booking.room.name }, ...freeRooms]
      : freeRooms;

  const nights = nightsBetween(booking.checkIn, booking.checkOut);
  const quote = computeQuote({
    nights,
    pricePerNightNpr: booking.pricePerNightNpr,
    childPricePerNightNpr: booking.childPricePerNightNpr,
    children: booking.children,
  });
  const checkInOpensOn = booking.checkIn > todayInResort() ? formatStayDate(booking.checkIn) : null;

  const created = first(sp.created) === "1";
  const emailed = first(sp.emailed);

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/bookings" className="text-forest underline underline-offset-4">
          ← All bookings
        </Link>
      </p>
      <PageHeader
        title={booking.bookingNumber}
        description={`${BOOKING_SOURCE_LABELS[booking.source]} request, received ${formatDateTime(booking.createdAt)}${
          booking.createdBy ? ` by ${booking.createdBy.name}` : ""
        }`}
        actions={<StatusBadge status={booking.status} />}
      />

      {created && (
        <div className="mb-6">
          <FormMessage type="success">
            Booking created.
            {emailed === "sent" && " An email was sent to the guest."}
            {emailed === "failed" && " The email to the guest could not be sent."}
            {emailed === "skipped" && " The guest has no email address, so no email was sent."}
          </FormMessage>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card title="Stay">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Item label="Check-in">
                {formatStayDate(booking.checkIn)}{terms.checkInTime ? `, from ${terms.checkInTime}` : ""}
              </Item>
              <Item label="Check-out">
                {formatStayDate(booking.checkOut)}{terms.checkOutTime ? `, by ${terms.checkOutTime}` : ""}
              </Item>
              <Item label="Nights">{nights}</Item>
              <Item label="Guests">
                {booking.adults} adult{booking.adults === 1 ? "" : "s"}
                {booking.children > 0 && `, ${booking.children} child${booking.children === 1 ? "" : "ren"} under ${BOOKING.childUnderAge}`}
              </Item>
              <Item label="Room type">{booking.roomType.name}</Item>
              <Item label="Room">{booking.room?.name ?? <span className="text-warning">Not assigned yet</span>}</Item>
              {booking.specialRequests && <Item label="Special requests" wide>{booking.specialRequests}</Item>}
              {booking.cancellationReason && <Item label="Cancellation reason" wide>{booking.cancellationReason}</Item>}
            </dl>
          </Card>

          <Card title="Price (saved with this booking)">
            <div className="text-sm">
              {quoteLines(quote, formatNpr).map((line) => (
                <p key={line} className="text-charcoal-light">
                  {line}
                </p>
              ))}
              <p className="mt-2 text-base font-semibold text-charcoal">Total: {formatNpr(booking.totalPriceNpr)}</p>
            </div>
          </Card>

          <Card title="Edit booking">
            <BookingEditForm
              key={booking.updatedAt.toISOString()}
              values={{
                bookingId: booking.id,
                roomTypeId: booking.roomTypeId,
                roomId: booking.roomId,
                checkIn: toDateOnlyString(booking.checkIn),
                checkOut: toDateOnlyString(booking.checkOut),
                adults: booking.adults,
                children: booking.children,
                specialRequests: booking.specialRequests ?? "",
                internalNotes: booking.internalNotes ?? "",
              }}
              flags={flags}
              roomTypes={roomTypes}
              rooms={editRooms}
              childUnderAge={BOOKING.childUnderAge}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Actions">
            <BookingActions
              bookingId={booking.id}
              status={booking.status}
              freeRooms={freeRooms}
              canCancel={can(user.role, "bookings.cancel")}
              checkInOpensOn={checkInOpensOn}
            />
          </Card>

          <Card title="Guest">
            <dl className="space-y-3 text-sm">
              <Item label="Name">
                <Link href={`/admin/guests/${booking.guest.id}`} className="text-forest underline underline-offset-2">
                  {booking.guest.name}
                </Link>
              </Item>
              <Item label="Phone">{booking.guest.phone ? <ContactPhone phone={booking.guest.phone} /> : "—"}</Item>
              <Item label="Email">
                {booking.guest.email ? (
                  <a href={`mailto:${booking.guest.email}`} className="break-all underline-offset-2 hover:underline">
                    {booking.guest.email}
                  </a>
                ) : (
                  "—"
                )}
              </Item>
              {booking.guest.country && <Item label="Country">{booking.guest.country}</Item>}
            </dl>
          </Card>

          {canSeeLog && (
            <Card title="History">
              {history.length === 0 ? (
                <p className="text-sm text-charcoal-light">No activity recorded.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {history.map((entry) => (
                    <li key={entry.id}>
                      <span className="font-medium">{entry.action}</span>
                      <span className="block text-xs text-charcoal-light">
                        {formatDateTime(entry.createdAt)} · {entry.user?.name ?? "Website / system"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-forest/10 bg-white p-5">
      <h2 className="mb-3 font-display text-lg text-forest">{title}</h2>
      {children}
    </section>
  );
}

function Item({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs text-charcoal-light">{label}</dt>
      <dd className="text-charcoal">{children}</dd>
    </div>
  );
}
