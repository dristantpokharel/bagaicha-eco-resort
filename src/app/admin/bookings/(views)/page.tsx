import Link from "next/link";
import { db } from "@/lib/db";
import { formatStayDate, nightsBetween } from "@/lib/booking/dates";
import { BOOKING_SOURCE_LABELS, BOOKING_STATUS_LABELS } from "@/lib/booking/labels";
import {
  BOOKING_SOURCES,
  BOOKING_STATUSES,
  bookingListSelect,
  buildBookingWhere,
  parseBookingFilters,
} from "@/lib/booking/admin-queries";
import { formatNpr } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { ContactPhone } from "@/components/admin/contact-phone";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";

export const metadata = { title: "Bookings" };

const PAGE_SIZE = 25;

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseBookingFilters(sp);
  const sort = sp.sort === "checkin" ? "checkin" : "newest";
  const pageParam = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const where = buildBookingWhere(filters);

  const [bookings, total, roomTypes] = await Promise.all([
    db.booking.findMany({
      where,
      select: bookingListSelect,
      orderBy: sort === "checkin" ? [{ checkIn: "desc" }, { createdAt: "desc" }] : { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.booking.count({ where }),
    db.roomType.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Object.values(filters).some(Boolean);
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({
      q: filters.q,
      status: filters.status,
      source: filters.source,
      roomType: filters.roomTypeId,
      from: filters.from,
      to: filters.to,
      sort: sort === "checkin" ? "checkin" : undefined,
      page: target > 1 ? String(target) : undefined,
    })) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `/admin/bookings?${qs}` : "/admin/bookings";
  };

  return (
    <div className="space-y-6">
      <form method="get" className="grid gap-3 rounded-lg border border-forest/10 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Label htmlFor="q">Search</Label>
          <Input id="q" name="q" defaultValue={filters.q} placeholder="Booking number, guest name, email or phone" maxLength={100} />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={filters.status ?? ""}>
            <option value="">All</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {BOOKING_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="source">Source</Label>
          <Select id="source" name="source" defaultValue={filters.source ?? ""}>
            <option value="">All</option>
            {BOOKING_SOURCES.map((s) => (
              <option key={s} value={s}>
                {BOOKING_SOURCE_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="roomType">Room type</Label>
          <Select id="roomType" name="roomType" defaultValue={filters.roomTypeId ?? ""}>
            <option value="">All</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="from">Stay from</Label>
          <Input id="from" name="from" type="date" defaultValue={filters.from} />
        </div>
        <div>
          <Label htmlFor="to">Stay until</Label>
          <Input id="to" name="to" type="date" defaultValue={filters.to} />
        </div>
        <div>
          <Label htmlFor="sort">Sort</Label>
          <Select id="sort" name="sort" defaultValue={sort}>
            <option value="newest">Newest requests first</option>
            <option value="checkin">Check-in date, latest first</option>
          </Select>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit">Apply filters</Button>
          {hasFilters && (
            <Link href="/admin/bookings" className={buttonClasses({ variant: "secondary" })}>
              Clear
            </Link>
          )}
        </div>
      </form>

      <p className="text-sm text-charcoal-light" aria-live="polite">
        {total} booking{total === 1 ? "" : "s"}
        {hasFilters ? " match your filters" : ""}.
      </p>

      {bookings.length === 0 ? (
        <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-8 text-center text-sm text-charcoal-light">
          {hasFilters ? "No bookings match these filters." : "No bookings yet. Requests from the website will appear here."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-forest/10 bg-white p-4">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-forest/10 text-xs tracking-wide text-charcoal-light uppercase">
              <tr>
                {["Booking", "Guest", "Stay", "Room", "Guests", "Total", "Status", "Requested"].map((h) => (
                  <th key={h} scope="col" className="py-2 pr-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-forest/10">
              {bookings.map((b) => (
                <tr key={b.id} className="align-top">
                  <td className="py-3 pr-4">
                    <Link href={`/admin/bookings/${b.id}`} className="font-medium text-forest underline-offset-2 hover:underline">
                      {b.bookingNumber}
                    </Link>
                    <div className="text-xs text-charcoal-light">{BOOKING_SOURCE_LABELS[b.source]}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <Link href={`/admin/guests/${b.guest.id}`} className="underline-offset-2 hover:underline">
                      {b.guest.name}
                    </Link>
                    {b.guest.phone && (
                      <div className="text-xs">
                        <ContactPhone phone={b.guest.phone} />
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {formatStayDate(b.checkIn)}
                    <div className="text-xs text-charcoal-light">
                      to {formatStayDate(b.checkOut)} ({nightsBetween(b.checkIn, b.checkOut)} night
                      {nightsBetween(b.checkIn, b.checkOut) === 1 ? "" : "s"})
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    {b.roomType.name}
                    <div className="text-xs text-charcoal-light">{b.room?.name ?? "Not assigned"}</div>
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    {b.adults + b.children}
                    {b.children > 0 && <span className="text-xs text-charcoal-light"> ({b.children} child)</span>}
                  </td>
                  <td className="py-3 pr-4 whitespace-nowrap">{formatNpr(b.totalPriceNpr)}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="py-3 text-xs whitespace-nowrap text-charcoal-light">{formatDateTime(b.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-charcoal-light">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
