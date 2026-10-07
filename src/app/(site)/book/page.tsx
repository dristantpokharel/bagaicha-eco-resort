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
import { loadAvailability } from "@/lib/booking/availability-data";
import { suggestAlternatives, type DateRangeSuggestion, type TypeSuggestion } from "@/lib/booking/availability-map";
import { describeCapacity, fittingTypes, partyFits, type Capacity } from "@/lib/booking/capacity";
import { addDays, formatCompactDate } from "@/lib/booking/dates";
import { computeQuote, quoteLines } from "@/lib/booking/pricing";
import { validateStay } from "@/lib/booking/rules";
import { formatNpr } from "@/lib/money";
import { getRoomTypes, getStayTerms } from "@/lib/content/queries";
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

  // Bookable types with their occupancy limits; drive the room pills, the steppers and the "fits" checks.
  const bookableTypes = await db.roomType.findMany({
    where: { isActive: true, rooms: { some: { isActive: true } } },
    select: { slug: true, name: true, maxGuests: true, maxAdults: true, maxChildren: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  // Public copy of each room (placeholder text is hidden in production) and the room picked on /stay.
  const terms = await getStayTerms();
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

  if (searched && bookableTypes.length > 0) {
    const stay = validateStay(defaults, { today, publicRequest: true });
    if (!stay.ok) {
      formErrors = stay.errors;
    } else if (fittingTypes(bookableTypes, defaults).length === 0) {
      content = <TooManyGuests />;
    } else {
      const available = await findAvailableRoomTypes(db, stay.checkIn, stay.checkOut, defaults);
      const withQuotes = available.map((roomType) => ({
        roomType,
        quote: computeQuote({
          nights: stay.nights,
          pricePerNightNpr: roomType.basePriceNpr,
          childPricePerNightNpr: roomType.childPricePerNightNpr,
          children: defaults.children,
        }),
      }));
      const requested = bookableTypes.find((r) => r.slug === first(sp.room));
      const chosen = withQuotes.find((r) => r.roomType.slug === requested?.slug);

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
              cancellationPolicy={terms.cancellationPolicy}
              summary={
                <StaySummary
                  roomTypeName={chosen.roomType.name}
                  checkIn={stay.checkIn}
                  checkOut={stay.checkOut}
                  adults={defaults.adults}
                  childCount={defaults.children}
                  quote={chosen.quote}
                  checkInTime={terms.checkInTime}
                  checkOutTime={terms.checkOutTime}
                  childUnderAge={terms.childUnderAge}
                />
              }
            />
          </>
        );
      } else if (requested || withQuotes.length === 0) {
        // The chosen room (or every room) can't take these dates: offer what does fit.
        const { types, index } = await loadAvailability(stay.checkIn, addDays(stay.checkIn, ALTERNATIVE_WINDOW_DAYS + stay.nights + 1));
        const alternatives = suggestAlternatives({
          index,
          types,
          chosenTypeId: types.find((t) => t.slug === requested?.slug)?.id ?? null,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          adults: defaults.adults,
          children: defaults.children,
          today,
          withinDays: ALTERNATIVE_WINDOW_DAYS,
          maxRanges: 3,
          maxDaysAhead: BOOKING.maxDaysAhead,
        });
        const tooSmall = requested && !partyFits(requested, defaults);
        content = (
          <Unavailable
            heading={
              requested
                ? tooSmall
                  ? `The ${requested.name} doesn't fit this group (${describeCapacity(requested).toLowerCase()})`
                  : `The ${requested.name} isn't available for those dates`
                : "Nothing available for those dates"
            }
            requestedName={tooSmall ? undefined : requested?.name}
            otherTypes={alternatives.otherTypes}
            dateRanges={alternatives.dateRanges}
            nights={stay.nights}
            descriptions={publicRooms}
            params={stringParams(defaults)}
            roomSlug={tooSmall ? undefined : requested?.slug}
          />
        );
      } else {
        content = (
          <div className="space-y-4" aria-live="polite">
            <h2 className="font-display text-2xl font-semibold italic text-ink-heading">Available for your dates</h2>
            <ul className="grid gap-5 md:grid-cols-2">
              {withQuotes.map(({ roomType, quote }) => (
                <RoomOption
                  key={roomType.id}
                  name={roomType.name}
                  capacity={roomType}
                  description={publicRooms.get(roomType.slug)?.description}
                  quote={quote}
                  href={roomHref(stringParams(defaults), roomType.slug)}
                  cta="Request this room"
                />
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
        line={[
          "Choose your dates to see what's available.",
          terms.checkInTime && terms.checkOutTime ? `Check-in is from ${terms.checkInTime}, check-out by ${terms.checkOutTime}.` : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
    <PublicShell>
      {preselected && !searched && (
        <p className="mb-4 border-l-4 border-leaf bg-sage px-4 py-3 text-ink" role="status">
          You are booking the <strong>{preselected.name}</strong>. Choose your dates to continue.
        </p>
      )}

      {bookableTypes.length > 0 ? (
        <div className="border border-forest/20 bg-white p-5">
          <SearchForm
            today={toDateOnlyString(today)}
            childUnderAge={terms.childUnderAge}
            roomTypes={bookableTypes}
            defaults={defaults}
            errors={formErrors}
            room={first(sp.room) || preselected?.slug}
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

const ALTERNATIVE_WINDOW_DAYS = 60;

const roomHref = (params: Record<string, string>, slug: string) => `/book?${new URLSearchParams({ ...params, room: slug })}`;

function RoomOption({
  name,
  capacity,
  description,
  quote,
  href,
  cta,
}: {
  name: string;
  capacity: Capacity;
  description?: string | null;
  quote: TypeSuggestion["quote"];
  href: string;
  cta: string;
}) {
  return (
    <li className="flex flex-col border border-forest/20 bg-white p-5">
      <h3 className="font-display text-xl font-semibold italic text-ink-heading">{name}</h3>
      <p className="mt-1 text-sm text-ink-muted">{describeCapacity(capacity, { childrenIncluded: true })}</p>
      {description && <p className="mt-3 text-sm text-ink">{description}</p>}
      <div className="mt-4 text-sm">
        {quoteLines(quote, formatNpr).map((line) => (
          <p key={line} className="text-ink-muted">
            {line}
          </p>
        ))}
        <p className="mt-2 text-lg font-semibold text-ink">Total: {formatNpr(quote.totalPriceNpr)}</p>
      </div>
      <Link href={href} className={buttonClasses({ variant: "brand", size: "lg", className: "mt-5 w-full" })}>
        {cta}
      </Link>
    </li>
  );
}

/** Shown when the chosen room type (or every type) can't take the dates: other rooms, other dates, then /enquiry. */
function Unavailable({
  heading,
  requestedName,
  otherTypes,
  dateRanges,
  nights,
  descriptions,
  params,
  roomSlug,
}: {
  heading: string;
  requestedName?: string;
  otherTypes: TypeSuggestion[];
  dateRanges: DateRangeSuggestion[];
  nights: number;
  descriptions: Map<string, { description?: string | null }>;
  params: Record<string, string>;
  roomSlug?: string;
}) {
  const nothing = otherTypes.length === 0 && dateRanges.length === 0;
  return (
    <div className="space-y-8" aria-live="polite">
      <h2 className="font-display text-2xl font-semibold italic text-ink-heading">{heading}</h2>

      {otherTypes.length > 0 && (
        <section className="space-y-4">
          <h3 className="font-label text-xs uppercase tracking-[0.14em] text-ink-heading">Available for the same dates</h3>
          <ul className="grid gap-5 md:grid-cols-2">
            {otherTypes.map(({ roomType, quote }) => (
              <RoomOption
                key={roomType.id}
                name={roomType.name}
                capacity={roomType}
                description={descriptions.get(roomType.slug)?.description}
                quote={quote}
                href={roomHref(params, roomType.slug)}
                cta="Choose this instead"
              />
            ))}
          </ul>
        </section>
      )}

      {dateRanges.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-label text-xs uppercase tracking-[0.14em] text-ink-heading">
            {requestedName ? `${requestedName} is free for ${nights} night${nights === 1 ? "" : "s"} on` : `Free for ${nights} night${nights === 1 ? "" : "s"} on`}
          </h3>
          <ul className="flex flex-wrap gap-3">
            {dateRanges.map((range) => (
              <li key={toDateOnlyString(range.checkIn)}>
                <Link
                  href={`/book?${new URLSearchParams({
                    ...params,
                    checkIn: toDateOnlyString(range.checkIn),
                    checkOut: toDateOnlyString(range.checkOut),
                    ...(roomSlug ? { room: roomSlug } : {}),
                  })}`}
                  className="inline-flex min-h-12 items-center border border-forest/40 bg-white px-4 text-sm text-forest hover:bg-sage"
                >
                  {formatCompactDate(range.checkIn)} → {formatCompactDate(range.checkOut)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {nothing && (
        <p className="text-ink">
          Please try other dates, or{" "}
          <Link href="/enquiry" className="text-forest underline underline-offset-4">
            send us an enquiry
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function backToResults(d: Parameters<typeof stringParams>[0]) {
  return `/book?${new URLSearchParams(stringParams(d))}`;
}

function TooManyGuests() {
  return (
    <p className="border border-forest/20 bg-white p-5 text-ink">
      None of our rooms takes a group like this in one room, and each booking is for one room. For a bigger group, please make
      separate bookings or{" "}
      <Link href="/enquiry" className="text-forest underline underline-offset-4">
        send us an enquiry
      </Link>
      .
    </p>
  );
}
