import type { Metadata } from "next";
import Link from "next/link";
import { BOOKING } from "@/config/booking";
import { PublicShell } from "@/components/booking/public-shell";
import { SearchForm } from "@/components/booking/search-form";
import { StaySummary } from "@/components/booking/stay-summary";
import { BookingForm } from "@/components/booking/booking-form";
import { buttonClasses } from "@/components/ui/button";
import { db } from "@/lib/db";
import { todayInResort } from "@/lib/dates";
import { toDateOnlyString } from "@/lib/booking/dates";
import { findAvailableRoomTypes } from "@/lib/booking/availability";
import { computeQuote, quoteLines } from "@/lib/booking/pricing";
import { validateStay } from "@/lib/booking/rules";
import { formatNpr } from "@/lib/money";
import { getRoomTypes } from "@/lib/content/queries";
import { pageMetadata } from "@/lib/seo";
import { PageIntro } from "@/components/site/page-intro";

export const generateMetadata = (): Promise<Metadata> =>
  pageMetadata({
    title: "Book your stay",
    description: "Request a stay at Bagaicha Eco Resort in Bardiya, Nepal. Choose your dates, see what is available and send a booking request.",
    path: "/book",
  });

type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function BookPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const today = todayInResort();

  // Largest party any bookable room sleeps; drives the guest pickers.
  const capacity = await db.roomType.aggregate({
    where: { isActive: true, rooms: { some: { isActive: true } } },
    _max: { maxGuests: true },
  });
  const maxGuests = capacity._max.maxGuests;
  // Public copy of each room (placeholder text is hidden in production) and the room picked on /stay.
  const publicRooms = new Map((await getRoomTypes()).map((r) => [r.slug, r]));
  const preselected = publicRooms.get(first(sp.room));

  const defaults = {
    checkIn: first(sp.checkIn),
    checkOut: first(sp.checkOut),
    adults: Number(first(sp.adults) || 2),
    children: Number(first(sp.children) || 0),
  };
  const searched = Boolean(defaults.checkIn || defaults.checkOut);

  let content: React.ReactNode = null;
  let formErrors: Record<string, string> | undefined;

  if (searched && maxGuests) {
    const stay = validateStay(defaults, { today, publicRequest: true });
    if (!stay.ok) {
      formErrors = stay.errors;
    } else if (defaults.adults + defaults.children > maxGuests) {
      content = <TooManyGuests maxGuests={maxGuests} />;
    } else {
      const available = await findAvailableRoomTypes(db, stay.checkIn, stay.checkOut, defaults.adults + defaults.children);
      const withQuotes = available.map((roomType) => ({
        roomType,
        quote: computeQuote({
          nights: stay.nights,
          pricePerNightNpr: roomType.basePriceNpr,
          childPricePerNightNpr: roomType.childPricePerNightNpr,
          children: defaults.children,
        }),
      }));
      const chosen = withQuotes.find((r) => r.roomType.slug === first(sp.room));

      if (chosen) {
        content = (
          <>
            <p className="mb-6">
              <Link href={backToResults(defaults)} className="text-sm text-forest underline underline-offset-4">
                ← Choose a different room
              </Link>
            </p>
            <BookingForm
              stay={{ ...defaults, roomTypeId: chosen.roomType.id }}
              defaultCountryCode={BOOKING.defaultCountryCode}
              summary={
                <StaySummary
                  roomTypeName={chosen.roomType.name}
                  checkIn={stay.checkIn}
                  checkOut={stay.checkOut}
                  adults={defaults.adults}
                  childCount={defaults.children}
                  quote={chosen.quote}
                />
              }
            />
          </>
        );
      } else {
        content = (
          <div className="space-y-4" aria-live="polite">
            <h2 className="font-display text-2xl font-semibold italic text-ink-heading">
              {withQuotes.length ? "Available for your dates" : "Nothing available for those dates"}
            </h2>
            {withQuotes.length === 0 && (
              <p className="text-ink">
                Please try other dates, or{" "}
                <Link href="/enquiry" className="text-forest underline underline-offset-4">
                  send us an enquiry
                </Link>
                .
              </p>
            )}
            <ul className="grid gap-5 md:grid-cols-2">
              {withQuotes.map(({ roomType, quote }) => (
                <li key={roomType.id} className="flex flex-col border border-forest/20 bg-white p-5">
                  <h3 className="font-display text-xl font-semibold italic text-ink-heading">{roomType.name}</h3>
                  <p className="mt-1 text-sm text-ink-muted">Sleeps up to {roomType.maxGuests}, children included</p>
                  {publicRooms.get(roomType.slug)?.description && <p className="mt-3 text-sm text-ink">{publicRooms.get(roomType.slug)?.description}</p>}
                  <div className="mt-4 text-sm">
                    {quoteLines(quote, formatNpr).map((line) => (
                      <p key={line} className="text-ink-muted">
                        {line}
                      </p>
                    ))}
                    <p className="mt-2 text-lg font-semibold text-ink">Total: {formatNpr(quote.totalPriceNpr)}</p>
                  </div>
                  <Link
                    href={`/book?${new URLSearchParams({ ...stringParams(defaults), room: roomType.slug })}`}
                    className={buttonClasses({ variant: "brand", size: "lg", className: "mt-5 w-full" })}
                  >
                    Request this room
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-sm text-ink-muted">
              One room per booking. For a larger group, make separate bookings or{" "}
              <Link href="/enquiry" className="text-forest underline underline-offset-4">
                send an enquiry
              </Link>
              .
            </p>
          </div>
        );
      }
    }
  }

  return (
    <>
      <PageIntro
        id="book-heading"
        strong="Book"
        soft="your stay"
        line={`Choose your dates to see what's available. Check-in is from ${BOOKING.checkInTime}, check-out by ${BOOKING.checkOutTime}.`}
      />
    <PublicShell>
      {preselected && !searched && (
        <p className="mb-4 border-l-4 border-leaf bg-sage px-4 py-3 text-ink" role="status">
          You are booking the <strong>{preselected.name}</strong>. Choose your dates to continue.
        </p>
      )}

      {maxGuests ? (
        <div className="border border-forest/20 bg-white p-5">
          <SearchForm
            today={toDateOnlyString(today)}
            maxGuests={maxGuests}
            childUnderAge={BOOKING.childUnderAge}
            defaults={defaults}
            errors={formErrors}
            room={preselected?.slug}
          />
        </div>
      ) : (
        <p className="mt-8 border border-forest/20 bg-white p-5 text-ink">
          Online booking isn&apos;t available right now.{" "}
          <Link href="/enquiry" className="text-forest underline underline-offset-4">
            Send us an enquiry
          </Link>{" "}
          and we&apos;ll get back to you.
        </p>
      )}

      <div className="mt-10">{content}</div>
    </PublicShell>
    </>
  );
}

function stringParams(d: { checkIn: string; checkOut: string; adults: number; children: number }) {
  return { checkIn: d.checkIn, checkOut: d.checkOut, adults: String(d.adults), children: String(d.children) };
}

function backToResults(d: Parameters<typeof stringParams>[0]) {
  return `/book?${new URLSearchParams(stringParams(d))}`;
}

function TooManyGuests({ maxGuests }: { maxGuests: number }) {
  return (
    <p className="border border-forest/20 bg-white p-5 text-ink">
      Our largest room sleeps {maxGuests} guests, and each booking is for one room. For a bigger group, please make separate
      bookings or{" "}
      <Link href="/enquiry" className="text-forest underline underline-offset-4">
        send us an enquiry
      </Link>
      .
    </p>
  );
}
