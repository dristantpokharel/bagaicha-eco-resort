import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { loadStayTerms } from "@/lib/content/stay-terms";
import { can, requirePagePermission } from "@/lib/auth";
import { ADMIN_SECTIONS } from "@/lib/admin-nav";
import { formatDateTime, todayInResort } from "@/lib/dates";
import { findFreeRooms } from "@/lib/booking/availability";
import { formatStayDate, nightsBetween, toDateOnlyString } from "@/lib/booking/dates";
import { BOOKING_SOURCE_LABELS } from "@/lib/booking/labels";
import { computeQuote, quoteLines } from "@/lib/booking/pricing";
import { deriveReservationStatus } from "@/lib/booking/reservation-status";
import { editableFlags, reservationDateFlags } from "@/lib/booking/status";
import { formatNpr } from "@/lib/money";
import { ContactPhone } from "@/components/admin/contact-phone";
import { PageHeader } from "@/components/admin/page-header";
import { ReservationStatusBadge } from "@/components/admin/status-badge";
import { FormMessage } from "@/components/ui/form";
import { LineCard, type LineView } from "./line-card";
import { ReservationActions } from "./reservation-actions";
import { ReservationEditForm } from "./reservation-edit-form";

export const metadata = { title: "Booking" };

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One reservation: the stay, every room with its own actions, the guest and the history. The id is the reservation's. */
export default async function ReservationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const user = await requirePagePermission(ADMIN_SECTIONS.bookings.permission);
  const { id } = await params;
  const sp = await searchParams;

  const reservation = await db.reservation.findUnique({
    where: { id },
    include: {
      guest: true,
      createdBy: { select: { name: true } },
      bookings: {
        include: { roomType: true, room: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!reservation) notFound();
  const terms = await loadStayTerms();

  const status = deriveReservationStatus(reservation.bookings);
  const canSeeLog = can(user.role, "activityLog.view");
  const dateFlags = reservationDateFlags(reservation.bookings.map((b) => b.status));
  const nights = nightsBetween(reservation.checkIn, reservation.checkOut);

  const [freeByLine, roomTypes, history] = await Promise.all([
    Promise.all(
      reservation.bookings.map(async (b) => {
        const f = editableFlags(b.status);
        if (b.status !== "PENDING" && !(b.status === "CONFIRMED" && f.room)) return [];
        const free = await findFreeRooms(db, b.roomTypeId, b.checkIn, b.checkOut, b.id);
        // The room it already has stays selectable even though it overlaps "itself".
        return b.room && !free.some((r) => r.id === b.room!.id) ? [{ id: b.room.id, name: b.room.name }, ...free] : free;
      }),
    ),
    reservation.bookings.some((b) => editableFlags(b.status).roomType)
      ? db.roomType.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
    canSeeLog
      ? db.activityLog.findMany({
          // Entries written before multi-room used the old booking id, which is this reservation's id.
          where: { entityType: { in: ["Reservation", "Booking"] }, entityId: reservation.id },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, action: true, createdAt: true, user: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const today = todayInResort();
  const views: LineView[] = reservation.bookings.map((b, i) => {
    const quote = computeQuote({
      nights: nightsBetween(b.checkIn, b.checkOut),
      pricePerNightNpr: b.pricePerNightNpr,
      childPricePerNightNpr: b.childPricePerNightNpr,
      children: b.children,
    });
    const flags = editableFlags(b.status);
    return {
      id: b.id,
      number: i + 1,
      status: b.status,
      roomTypeId: b.roomTypeId,
      roomTypeName: b.roomType.name,
      roomId: b.roomId,
      roomName: b.room?.name ?? null,
      adults: b.adults,
      children: b.children,
      guestsLabel: `${plural(b.adults, "adult", "adults")}${b.children > 0 ? `, ${plural(b.children, "child", "children")} under ${terms.childUnderAge}` : ""}`,
      priceLines: quoteLines(quote, formatNpr),
      totalLabel: `Room total: ${formatNpr(b.totalPriceNpr)}`,
      cancellationReason: b.cancellationReason,
      flags: { party: flags.party, roomType: flags.roomType, room: flags.room },
      rooms: freeByLine[i],
    };
  });

  const pendingCount = reservation.bookings.filter((b) => b.status === "PENDING").length;
  const cancellableCount = reservation.bookings.filter((b) => b.status === "PENDING" || b.status === "CONFIRMED").length;
  const checkInOpensOn = reservation.checkIn > today ? formatStayDate(reservation.checkIn) : null;
  const guests = reservation.bookings.filter((b) => b.status !== "CANCELLED");
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
        title={reservation.reference}
        description={`${BOOKING_SOURCE_LABELS[reservation.source]} request, received ${formatDateTime(reservation.createdAt)}${
          reservation.createdBy ? ` by ${reservation.createdBy.name}` : ""
        }`}
        actions={<ReservationStatusBadge status={status} />}
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
                {formatStayDate(reservation.checkIn)}
                {terms.checkInTime ? `, from ${terms.checkInTime}` : ""}
              </Item>
              <Item label="Check-out">
                {formatStayDate(reservation.checkOut)}
                {terms.checkOutTime ? `, by ${terms.checkOutTime}` : ""}
              </Item>
              <Item label="Nights">{nights}</Item>
              <Item label="Rooms">
                {plural(reservation.bookings.length, "room", "rooms")}
                {reservation.bookings.length !== guests.length && ` (${guests.length} not cancelled)`}
              </Item>
              {reservation.specialRequests && (
                <Item label="Special requests" wide>
                  {reservation.specialRequests}
                </Item>
              )}
            </dl>
          </Card>

          <Card title={`Rooms (${reservation.bookings.length})`}>
            <ul className="-mx-5 divide-y divide-forest/10 border-y border-forest/10">
              {views.map((line) => (
                <LineCard key={`${line.id}-${reservation.updatedAt.toISOString()}`} line={line} roomTypes={roomTypes} canCancel={can(user.role, "bookings.cancel")} checkInOpensOn={checkInOpensOn} childUnderAge={terms.childUnderAge} />
              ))}
            </ul>
            <p className="mt-4 text-base font-semibold text-charcoal">
              Total: {formatNpr(reservation.totalPriceNpr)}
              {reservation.bookings.length !== guests.length && (
                <span className="ml-2 text-xs font-normal text-charcoal-light">(rooms that are not cancelled; prices saved with each room)</span>
              )}
            </p>
          </Card>

          <Card title="Edit booking">
            <ReservationEditForm
              key={reservation.updatedAt.toISOString()}
              values={{
                reservationId: reservation.id,
                checkIn: toDateOnlyString(reservation.checkIn),
                checkOut: toDateOnlyString(reservation.checkOut),
                specialRequests: reservation.specialRequests ?? "",
                internalNotes: reservation.internalNotes ?? "",
              }}
              flags={dateFlags}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Actions">
            <ReservationActions
              reservationId={reservation.id}
              pendingCount={pendingCount}
              cancellableCount={cancellableCount}
              canCancel={can(user.role, "bookings.cancel")}
            />
          </Card>

          <Card title="Guest">
            <dl className="space-y-3 text-sm">
              <Item label="Name">
                <Link href={`/admin/guests/${reservation.guest.id}`} className="text-forest underline underline-offset-2">
                  {reservation.guest.name}
                </Link>
              </Item>
              <Item label="Phone">{reservation.guest.phone ? <ContactPhone phone={reservation.guest.phone} /> : "—"}</Item>
              <Item label="Email">
                {reservation.guest.email ? (
                  <a href={`mailto:${reservation.guest.email}`} className="break-all underline-offset-2 hover:underline">
                    {reservation.guest.email}
                  </a>
                ) : (
                  "—"
                )}
              </Item>
              {reservation.guest.country && <Item label="Country">{reservation.guest.country}</Item>}
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
