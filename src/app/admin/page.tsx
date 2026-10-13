import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db";
import { can, requirePageUser } from "@/lib/auth";
import { loadToday, type TodayLine, type TodayReservation } from "@/lib/admin/today";
import { parseDateOnly } from "@/lib/booking/dates";
import { listLowStockItems } from "@/lib/inventory/queries";
import { formatQuantityWithUnit } from "@/lib/inventory/stock";
import { listPlaceholders } from "@/lib/content/placeholder-report";
import { summariseRooms } from "@/lib/booking/multi-room";
import { formatShortDate } from "@/lib/booking/dates";
import { ContactPhone } from "@/components/admin/contact-phone";
import { StatusBadge } from "@/components/admin/status-badge";
import { StockBadge } from "@/components/admin/stock-badge";
import { buttonClasses } from "@/components/ui/button";
import { AssignConfirm, CheckInButton, CheckOutButton, ConfirmRequestButton } from "./today-actions";

export const metadata = { title: "Today" };

const LOW_STOCK_SHOWN = 8;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const lineName = (l: TodayLine) => (l.roomName ? `${l.roomTypeName} · ${l.roomName}` : `${l.roomTypeName} (no room yet)`);

export default async function TodayPage() {
  const user = await requirePageUser();
  const canBookings = can(user.role, "bookings.manage");
  const canStatus = can(user.role, "bookings.changeStatus");
  const canEnquiries = can(user.role, "enquiries.manage");
  const canInventory = can(user.role, "inventory.recordMovements");

  const [today, lowStock, newEnquiries, placeholders] = await Promise.all([
    loadToday(db, user.role),
    canInventory ? listLowStockItems() : [],
    canEnquiries ? db.enquiry.count({ where: { status: "NEW" } }) : 0,
    can(user.role, "content.manage") ? listPlaceholders() : null,
  ]);
  const dateLabel = formatInTimeZone(parseDateOnly(today.date)!, "UTC", "EEEE, d MMMM yyyy");
  const arrivalsToDo = today.arrivals.filter((r) => r.lines.some((l) => l.status !== "CHECKED_IN")).length;
  const departuresToDo = today.departures.filter((r) => r.lines.some((l) => l.status === "CHECKED_IN")).length;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-forest">Today</h1>
          <p className="mt-1 text-sm text-charcoal">{dateLabel}</p>
          {canBookings && (
            <p className="mt-0.5 text-sm text-charcoal-light">
              Tonight: <strong className="font-semibold text-charcoal">{today.occupiedTonight}</strong> of {plural(today.totalRooms, "room")} occupied
            </p>
          )}
          {newEnquiries > 0 && (
            <p className="mt-0.5 text-sm">
              <Link href="/admin/enquiries?status=NEW" className="text-forest underline underline-offset-4">
                {plural(newEnquiries, "new enquiry", "new enquiries")}
              </Link>
            </p>
          )}
        </div>
        {canBookings && (
          <Link href="/admin/bookings/new" className={buttonClasses({ className: "min-h-11 w-full sm:w-auto" })}>
            New booking
          </Link>
        )}
      </header>

      {canBookings && (
        <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <Section title="Arrivals today" count={arrivalsToDo} total={today.arrivals.length} empty="No arrivals expected today.">
            {today.arrivals.map((r) => {
              const confirmed = r.lines.filter((l) => l.status === "CONFIRMED");
              return (
                <Row key={r.id} r={r} detail={`${plural(r.nights, "night")} · to ${formatShortDate(parseDateOnly(r.checkOut)!)}`}>
                  <ul className="mt-2 space-y-2">
                    {r.lines.map((l) => (
                      <LineItem key={l.id} line={l}>
                        {canStatus && l.status === "CONFIRMED" && <CheckInButton bookingIds={[l.id]} room={lineName(l)} />}
                        {canStatus && l.status === "PENDING" && (
                          <AssignConfirm bookingId={l.id} rooms={today.freeRooms[l.id] ?? []} typeName={l.roomTypeName} />
                        )}
                      </LineItem>
                    ))}
                  </ul>
                  {canStatus && confirmed.length > 1 && (
                    <div className="mt-2">
                      <CheckInButton bookingIds={confirmed.map((l) => l.id)} all />
                    </div>
                  )}
                </Row>
              );
            })}
          </Section>

          <Section title="Departures today" count={departuresToDo} total={today.departures.length} empty="No departures expected today.">
            {today.departures.map((r) => {
              const inRooms = r.lines.filter((l) => l.status === "CHECKED_IN");
              return (
                <Row key={r.id} r={r}>
                  <ul className="mt-2 space-y-2">
                    {r.lines.map((l) => (
                      <LineItem key={l.id} line={l}>
                        {canStatus && l.status === "CHECKED_IN" && <CheckOutButton bookingIds={[l.id]} room={lineName(l)} />}
                      </LineItem>
                    ))}
                  </ul>
                  {canStatus && inRooms.length > 1 && (
                    <div className="mt-2">
                      <CheckOutButton bookingIds={inRooms.map((l) => l.id)} all />
                    </div>
                  )}
                </Row>
              );
            })}
          </Section>

          <Section title="In-house now" count={today.inHouse.length} empty="Nobody is staying on past today.">
            {today.inHouse.map((r) => (
              <Row key={r.id} r={r} detail={`${r.lines.map((l) => l.roomName ?? l.roomTypeName).join(", ")} · until ${formatShortDate(parseDateOnly(r.checkOut)!)}`} />
            ))}
          </Section>

          <Section
            title="Pending requests"
            count={today.pending.total}
            empty="No requests waiting."
            footer={
              today.pending.total > today.pending.items.length ? (
                <Link href="/admin/bookings?status=PENDING" className="text-forest underline underline-offset-4">
                  See all {today.pending.total} pending requests
                </Link>
              ) : undefined
            }
          >
            {today.pending.items.map((r) => (
              <Row
                key={r.id}
                r={r}
                detail={`${formatShortDate(parseDateOnly(r.checkIn)!)} to ${formatShortDate(parseDateOnly(r.checkOut)!)} · ${summariseRooms(r.lines.map((l) => l.roomTypeName))}`}
                note={`Waiting ${r.waiting}`}
              >
                <div className="mt-2 flex flex-wrap items-start gap-2">
                  {canStatus && <ConfirmRequestButton reservationId={r.id} rooms={r.lines.length} />}
                  <Link href={`/admin/bookings/${r.id}`} className={buttonClasses({ variant: "secondary", className: "min-h-11 px-4" })}>
                    Open
                  </Link>
                </div>
              </Row>
            ))}
          </Section>

          <Section title="Next 7 days" count={today.nextDays.reduce((n, d) => n + d.arriving, 0)} countLabel="arriving" empty="">
            {today.nextDays.map((d) => {
              const date = parseDateOnly(d.date)!;
              const quiet = d.arriving === 0 && d.departing === 0;
              return (
                <li key={d.date}>
                  <Link
                    href={`/admin/bookings?from=${d.date}&to=${d.date}`}
                    className="flex min-h-11 items-center justify-between gap-3 py-1.5 text-sm hover:bg-forest/5"
                  >
                    <span className="font-medium text-charcoal">{formatInTimeZone(date, "UTC", "EEE d MMM")}</span>
                    <span className={quiet ? "text-charcoal-light" : "text-charcoal"}>
                      {quiet ? "Quiet" : [d.arriving ? `${d.arriving} arriving` : null, d.departing ? `${d.departing} leaving` : null].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </Section>
        </div>
      )}

      {canInventory && (
        <div className="mt-4 grid gap-4 lg:mt-6 lg:grid-cols-2 lg:gap-6">
          <Section
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
              <li key={item.id} className="flex min-h-11 items-center justify-between gap-3 py-1.5 text-sm">
                <Link href={`/admin/inventory/${item.id}`} className="font-medium text-forest underline-offset-4 hover:underline">
                  {item.name}
                </Link>
                <span className="flex items-center gap-2">
                  <StockBadge item={item} />
                  <span className="whitespace-nowrap tabular-nums">{formatQuantityWithUnit(item.quantity, item.unit)}</span>
                </span>
              </li>
            ))}
          </Section>
        </div>
      )}

      {placeholders && (
        <div className="mt-4 lg:mt-6">
          <Section
            title="Placeholders (must be replaced before launch)"
            count={placeholders.length}
            empty="No placeholder content is left."
            footer={placeholders.length > 0 ? "Placeholders show with a badge while developing and are hidden on the live site." : undefined}
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
          </Section>
        </div>
      )}
    </>
  );
}

function Section({
  title,
  count,
  total,
  countLabel,
  empty,
  children,
  footer,
}: {
  title: string;
  count: number;
  /** When set, the heading reads "count of total" (e.g. arrivals still to check in). */
  total?: number;
  countLabel?: string;
  empty: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const nothing = total !== undefined ? total === 0 : count === 0 && empty !== "";
  return (
    <section className="rounded-lg border border-forest/10 bg-white p-4 sm:p-5" aria-label={title}>
      <h2 className="mb-3 flex items-baseline justify-between gap-3 font-display text-lg text-forest">
        {title}
        <span className="text-sm font-normal text-charcoal-light">
          {total !== undefined ? `${count} to do · ${total} in all` : countLabel ? `${count} ${countLabel}` : count}
        </span>
      </h2>
      {nothing ? <p className="text-sm text-charcoal-light">{empty}</p> : <ul className="divide-y divide-forest/10">{children}</ul>}
      {footer && <p className="mt-3 text-sm">{footer}</p>}
    </section>
  );
}

function Row({ r, detail, note, children }: { r: TodayReservation; detail?: string; note?: string; children?: React.ReactNode }) {
  return (
    <li className="py-3 text-sm first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <Link href={`/admin/bookings/${r.id}`} className="inline-flex min-h-6 items-center font-medium text-forest underline-offset-2 hover:underline">
          {r.guestName}
        </Link>
        <span className="text-xs text-charcoal-light">{r.reference}</span>
      </div>
      {detail && <p className="text-charcoal-light">{detail}</p>}
      {note && <p className="text-xs text-warning">{note}</p>}
      {r.guestPhone && (
        <p className="text-xs">
          <ContactPhone phone={r.guestPhone} />
        </p>
      )}
      {children}
    </li>
  );
}

function LineItem({ line, children }: { line: TodayLine; children?: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-cream/60 p-2">
      <div className="min-w-0">
        <p className="font-medium text-charcoal">{lineName(line)}</p>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-charcoal-light">
          <StatusBadge status={line.status} />
          {plural(line.guests, "guest")}
        </p>
      </div>
      {children}
    </li>
  );
}
