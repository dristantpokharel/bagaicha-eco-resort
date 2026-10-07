import type { Metadata } from "next";
import Link from "next/link";
import { BOOKING } from "@/config/booking";
import { PublicShell } from "@/components/booking/public-shell";
import { StaySummary } from "@/components/booking/stay-summary";
import { BookingForm } from "@/components/booking/booking-form";
import { StayBuilder } from "@/components/booking/stay-builder";
import { db } from "@/lib/db";
import { todayInResort } from "@/lib/dates";
import { toDateOnlyString } from "@/lib/booking/dates";
import { findFreeCounts } from "@/lib/booking/availability";
import { quoteReservation, validateSplit, type RoomLine, type RoomTypeForBooking } from "@/lib/booking/multi-room";
import { DEFAULT_PARTY, startingParty, type BuilderRoom, type BuilderType } from "@/lib/booking/room-builder";
import { validateStay } from "@/lib/booking/rules";
import { decodeRooms } from "@/lib/booking/selection-url";
import { getStayTerms } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo";
import { PageIntro } from "@/components/site/page-intro";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({
    title: "Book your stay",
    description: "Request a stay at Bagaicha Eco Resort in Bardiya, Nepal. Choose your dates and rooms, see what is available and send a booking request.",
    path: "/book",
  });

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function BookPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const today = todayInResort();

  // Bookable types with their prices and occupancy limits; they drive the room buttons, the steppers and every "fits" check.
  const bookable = await db.roomType.findMany({
    where: { isActive: true, rooms: { some: { isActive: true } } },
    select: { id: true, slug: true, name: true, maxGuests: true, maxAdults: true, maxChildren: true, basePriceNpr: true, childPricePerNightNpr: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const terms = await getStayTerms();
  const builderTypes: BuilderType[] = bookable.map((type) => ({ ...type }));
  const bySlug = new Map(bookable.map((t) => [t.slug, t]));

  // The rooms in the URL (or Room 1 from "Book this room" on /stay). Unknown types become "no type yet"; extra rooms are dropped.
  const decoded = decodeRooms(first(sp.rooms));
  const preselected = bySlug.get(first(sp.room));
  const initialRooms: BuilderRoom[] = decoded
    ? decoded.slice(0, BOOKING.maxRoomsPerRequest).map((r) => ({ ...r, slug: r.slug && bySlug.has(r.slug) ? r.slug : null }))
    : [preselected ? { slug: preselected.slug, ...startingParty(preselected) } : { slug: null, ...DEFAULT_PARTY }];

  const checkIn = first(sp.checkIn);
  const checkOut = first(sp.checkOut);
  const party = {
    adults: initialRooms.reduce((n, r) => n + r.adults, 0),
    children: initialRooms.reduce((n, r) => n + r.children, 0),
  };
  const stay = checkIn && checkOut ? validateStay({ checkIn, checkOut, ...party }, { today, publicRequest: true }) : null;
  const freeList = stay?.ok ? await findFreeCounts(db, stay.checkIn, stay.checkOut) : null;
  const free = freeList && Object.fromEntries(freeList.map((f) => [f.type.slug, f.free]));

  let notice: string | undefined;
  let details: React.ReactNode = null;

  if (first(sp.step) === "details") {
    const lines = stay?.ok && free ? resolveRooms(initialRooms, decoded?.length ?? 0, free, bySlug) : null;
    if (stay?.ok && lines) {
      const types = new Map<string, RoomTypeForBooking>(bookable.map((t) => [t.id, t]));
      const quote = quoteReservation(lines, types, stay.nights);
      details = (
        <>
          <p className="mb-6">
            <Link href={`/book?${new URLSearchParams({ checkIn, checkOut, rooms: first(sp.rooms) })}`} className="text-sm text-forest underline underline-offset-4">
              ← Change dates or rooms
            </Link>
          </p>
          <BookingForm
            stay={{ checkIn, checkOut, ...party }}
            rooms={lines}
            defaultCountryCode={BOOKING.defaultCountryCode}
            cancellationPolicy={terms.cancellationPolicy}
            summary={
              <StaySummary
                rooms={lines.map((line, i) => ({
                  roomTypeName: types.get(line.roomTypeId)!.name,
                  adults: line.adults,
                  children: line.children,
                  quote: quote.lines[i],
                }))}
                checkIn={stay.checkIn}
                checkOut={stay.checkOut}
                checkInTime={terms.checkInTime}
                checkOutTime={terms.checkOutTime}
                childUnderAge={terms.childUnderAge}
              />
            }
          />
        </>
      );
    } else {
      notice = "That room selection is no longer available. Please check your dates and rooms again.";
    }
  }

  return (
    <>
      <PageIntro
        id="book-heading"
        strong="Book"
        soft="your stay"
        line={[
          "Choose your dates, then build your stay room by room.",
          terms.checkInTime && terms.checkOutTime ? `Check-in is from ${terms.checkInTime}, check-out by ${terms.checkOutTime}.` : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
      <PublicShell>
        {bookable.length === 0 ? (
          <p className="border border-forest/20 bg-white p-5 text-ink">
            Online booking isn&apos;t available right now.{" "}
            <Link href="/enquiry" className="text-forest underline underline-offset-4">
              Send us an enquiry
            </Link>{" "}
            and we&apos;ll get back to you.
          </p>
        ) : (
          details ?? (
            <StayBuilder
              today={toDateOnlyString(today)}
              childUnderAge={terms.childUnderAge}
              types={builderTypes}
              initial={{ checkIn, checkOut, rooms: initialRooms }}
              free={free}
              freeFor={`${checkIn}|${checkOut}`}
              dateError={stay && !stay.ok ? (stay.errors.checkIn ?? stay.errors.checkOut) : undefined}
              notice={notice}
            />
          )
        )}
      </PublicShell>
    </>
  );
}

/**
 * Turns the rooms in the URL into booking lines, or null if anything is off: more rooms than allowed, a room with no
 * or an unknown type, a type with fewer free rooms than asked for, or guests the type can't hold.
 * Prices are never read from the URL; the caller prices these lines from the database rows.
 */
function resolveRooms(
  rooms: BuilderRoom[],
  requested: number,
  free: Record<string, number>,
  bySlug: ReadonlyMap<string, RoomTypeForBooking & { slug: string }>,
): RoomLine[] | null {
  if (requested > BOOKING.maxRoomsPerRequest) return null;
  const used = new Map<string, number>();
  const lines: RoomLine[] = [];
  for (const room of rooms) {
    const type = room.slug ? bySlug.get(room.slug) : undefined;
    if (!type) return null;
    used.set(type.slug, (used.get(type.slug) ?? 0) + 1);
    if (used.get(type.slug)! > (free[type.slug] ?? 0)) return null;
    lines.push({ roomTypeId: type.id, adults: room.adults, children: room.children });
  }
  const party = { adults: lines.reduce((n, l) => n + l.adults, 0), children: lines.reduce((n, l) => n + l.children, 0) };
  const types = new Map([...bySlug.values()].map((t) => [t.id, t]));
  return validateSplit(lines, types, party).ok ? lines : null;
}
