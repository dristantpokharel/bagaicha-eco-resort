import type { Metadata } from "next";
import Link from "next/link";
import { BOOKING } from "@/config/booking";
import { PublicShell } from "@/components/booking/public-shell";
import { SearchForm } from "@/components/booking/search-form";
import { StaySummary } from "@/components/booking/stay-summary";
import { BookingForm } from "@/components/booking/booking-form";
import { RoomSelector, type SelectorType } from "@/components/booking/room-selector";
import { buttonClasses } from "@/components/ui/button";
import { db } from "@/lib/db";
import { todayInResort } from "@/lib/dates";
import { toDateOnlyString } from "@/lib/booking/dates";
import { findFreeCounts } from "@/lib/booking/availability";
import { loadAvailability } from "@/lib/booking/availability-data";
import { suggestAlternatives, unavailableReason, type CombinationSuggestion, type DateRangeSuggestion, type UnavailableReason } from "@/lib/booking/availability-map";
import { describeCapacity, partyFits } from "@/lib/booking/capacity";
import { addDays, formatCompactDate } from "@/lib/booking/dates";
import { canSeatFromFree, quoteReservation, suggestCombination, summariseRooms, validateSplit, type RoomLine, type RoomTypeForBooking } from "@/lib/booking/multi-room";
import { validateStay } from "@/lib/booking/rules";
import { decodeLines, decodePick, encodePick } from "@/lib/booking/selection-url";
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
    select: { slug: true, name: true, maxGuests: true, maxAdults: true, maxChildren: true, _count: { select: { rooms: { where: { isActive: true } } } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  }).then((rows) => rows.map(({ _count, ...type }) => ({ ...type, rooms: _count.rooms })));
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
    const party = { adults: defaults.adults, children: defaults.children };
    if (!stay.ok) {
      formErrors = stay.errors;
    } else if (!canSeatFromFree(party, bookableTypes.map((t) => ({ type: t, free: t.rooms })))) {
      content = <TooManyGuests />;
    } else {
      const free = await findFreeCounts(db, stay.checkIn, stay.checkOut);
      const pill = bookableTypes.find((r) => r.slug === first(sp.room));
      const visible = pill ? free.filter((f) => f.type.slug === pill.slug) : free;
      const params = { ...stringParams(defaults), ...(pill ? { room: pill.slug } : {}) };
      const types = new Map(free.map((f) => [f.type.id, f.type]));

      if (!canSeatFromFree(party, visible.map((f) => ({ type: f.type, free: f.free })))) {
        // Not enough rooms are free for the whole stay: offer a combination, other dates, then /enquiry.
        const { types: infoTypes, index } = await loadAvailability(stay.checkIn, addDays(stay.checkIn, ALTERNATIVE_WINDOW_DAYS + stay.nights + 1));
        const pillInfo = infoTypes.find((t) => t.slug === pill?.slug);
        const alternatives = suggestAlternatives({
          index,
          types: infoTypes,
          chosenTypeId: pillInfo?.id ?? null,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          adults: defaults.adults,
          children: defaults.children,
          today,
          withinDays: ALTERNATIVE_WINDOW_DAYS,
          maxRanges: 3,
          maxDaysAhead: BOOKING.maxDaysAhead,
        });
        const dates = `${formatCompactDate(stay.checkIn)} → ${formatCompactDate(stay.checkOut)}`;
        const pillFree = visible[0]?.free ?? 0;
        const pillFitsEver = pill ? canSeatFromFree(party, [{ type: pill, free: pill.rooms }]) : true;
        content = (
          <Unavailable
            heading={
              pill
                ? pillFitsEver
                  ? `${pill.name} isn't available for your group on ${dates}`
                  : `${pill.name} can't hold this group`
                : `Nothing is available for your group on ${dates}`
            }
            reason={
              pill
                ? pillFitsEver
                  ? pillFree === 0 && pillInfo
                    ? reasonText(pill.name, unavailableReason(index, pillInfo.id, stay.checkIn, stay.checkOut))
                    : `Only ${pillFree} ${pill.name} ${pillFree === 1 ? "room is" : "rooms are"} free for the whole stay, which isn't enough for your group.`
                  : `${describeCapacity(pill)} per room, and we take up to ${BOOKING.maxRoomsPerRequest} rooms online.`
                : "Not enough rooms are free for the whole stay to seat your group."
            }
            requestedName={pill && pillFitsEver ? pill.name : undefined}
            combination={alternatives.combination}
            names={new Map(infoTypes.map((t) => [t.id, { name: t.name, slug: t.slug }]))}
            dateRanges={alternatives.dateRanges}
            nights={stay.nights}
            params={params}
            roomSlug={pill && pillFitsEver ? pill.slug : undefined}
          />
        );
      } else {
        const decoded = decodeLines(first(sp.lines));
        const chosen = decoded ? resolveLines(decoded, free, types, party) : null;

        if (chosen) {
          const quote = quoteReservation(chosen, types, stay.nights);
          content = (
            <>
              <p className="mb-6">
                <Link href={`/book?${new URLSearchParams({ ...params, pick: encodePick(countByTypeSlug(chosen, types)) })}`} className="text-sm text-forest underline underline-offset-4">
                  ← Change rooms
                </Link>
              </p>
              <BookingForm
                stay={{ ...defaults }}
                rooms={chosen}
                defaultCountryCode={BOOKING.defaultCountryCode}
                cancellationPolicy={terms.cancellationPolicy}
                summary={
                  <StaySummary
                    rooms={chosen.map((line, i) => ({
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
          const selectorTypes: SelectorType[] = visible.map(({ type, free: n }) => ({
            id: type.id,
            slug: type.slug,
            name: type.name,
            description: publicRooms.get(type.slug)?.description ?? null,
            free: n,
            maxGuests: type.maxGuests,
            maxAdults: type.maxAdults,
            maxChildren: type.maxChildren,
            basePriceNpr: type.basePriceNpr,
            childPricePerNightNpr: type.childPricePerNightNpr,
          }));
          const picked = decodePick(first(sp.pick));
          const initialCounts: Record<string, number> = {};
          for (const t of selectorTypes) if (picked[t.slug]) initialCounts[t.id] = picked[t.slug];
          if (Object.keys(initialCounts).length === 0 && pill) {
            // Coming from a room on /stay: start with as few rooms of that type as hold the group.
            const entry = visible[0];
            for (let n = 1; entry && n <= Math.min(entry.free, BOOKING.maxRoomsPerRequest); n++) {
              if (canSeatFromFree(party, [{ type: entry.type, free: n }], n)) {
                initialCounts[entry.type.id] = n;
                break;
              }
            }
          }
          const combo = visible.some((f) => partyFits(f.type, party))
            ? null
            : suggestCombination(party, visible, stay.nights);
          content = (
            <RoomSelector
              // A new search or a new link must not inherit the previous selection.
              key={`${params.checkIn}|${params.checkOut}|${params.adults}|${params.children}|${params.room ?? ""}|${first(sp.pick)}`}
              types={selectorTypes}
              party={party}
              nights={stay.nights}
              childUnderAge={terms.childUnderAge}
              params={params}
              initialCounts={initialCounts}
              suggestion={
                combo
                  ? {
                      counts: countByTypeId(combo.lines),
                      label: summariseRooms(combo.lines.map((l) => types.get(l.roomTypeId)!.name)),
                    }
                  : null
              }
              notice={decoded ? "That room selection is no longer available. Please choose your rooms again." : undefined}
            />
          );
        }
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

type FreeEntry = { type: { id: string; slug: string; name: string }; free: number };

/** Turns the lines in the URL into room lines, or null if any is unknown, doesn't fit, isn't free or doesn't add up to the party. */
function resolveLines(
  decoded: { slug: string; adults: number; children: number }[],
  free: FreeEntry[],
  types: ReadonlyMap<string, RoomTypeForBooking>,
  party: { adults: number; children: number },
): RoomLine[] | null {
  const bySlug = new Map(free.map((f) => [f.type.slug, f]));
  const lines: RoomLine[] = [];
  const used = new Map<string, number>();
  for (const d of decoded) {
    const entry = bySlug.get(d.slug);
    if (!entry) return null;
    used.set(entry.type.id, (used.get(entry.type.id) ?? 0) + 1);
    if (used.get(entry.type.id)! > entry.free) return null;
    lines.push({ roomTypeId: entry.type.id, adults: d.adults, children: d.children });
  }
  return validateSplit(lines, types, party).ok ? lines : null;
}

function countByTypeId(lines: RoomLine[]) {
  const out: Record<string, number> = {};
  for (const l of lines) out[l.roomTypeId] = (out[l.roomTypeId] ?? 0) + 1;
  return out;
}

function countByTypeSlug(lines: RoomLine[], types: ReadonlyMap<string, { slug: string }>) {
  const out: Record<string, number> = {};
  for (const l of lines) {
    const slug = types.get(l.roomTypeId)!.slug;
    out[slug] = (out[slug] ?? 0) + 1;
  }
  return out;
}

function reasonText(name: string, reason: UnavailableReason | null): string | null {
  if (!reason) return null;
  if (reason.kind === "sold-out") {
    return `Sold out on ${reason.soldOutNights} of the ${reason.nights} night${reason.nights === 1 ? "" : "s"}.`;
  }
  return `Every ${name} is free on some of these nights, but no single room is free for the whole stay.`;
}

/** Shown when the party can't be seated for the dates: a working combination, other dates, then /enquiry. */
function Unavailable({
  heading,
  reason,
  requestedName,
  combination,
  names,
  dateRanges,
  nights,
  params,
  roomSlug,
}: {
  heading: string;
  reason: string | null;
  requestedName?: string;
  combination: CombinationSuggestion | null;
  names: Map<string, { name: string; slug: string }>;
  dateRanges: DateRangeSuggestion[];
  nights: number;
  params: Record<string, string>;
  roomSlug?: string;
}) {
  const nothing = !combination && dateRanges.length === 0;
  const searchOnly = Object.fromEntries(Object.entries(params).filter(([key]) => key !== "room"));
  return (
    <div className="space-y-8" aria-live="polite">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold italic text-ink-heading">{heading}</h2>
        {reason && <p className="text-ink">{reason}</p>}
      </div>

      {combination && (
        <section className="space-y-3 border border-forest/20 bg-white p-5">
          <h3 className="font-label text-xs uppercase tracking-[0.14em] text-ink-heading">Free for your dates and group</h3>
          <p className="text-ink">{summariseRooms(combination.lines.map((l) => names.get(l.roomTypeId)!.name))}</p>
          <p className="text-lg font-semibold text-ink">Total: {formatNpr(combination.quote.totalPriceNpr)}</p>
          <Link
            href={`/book?${new URLSearchParams({
              ...searchOnly,
              pick: encodePick(countByTypeSlug(combination.lines, names)),
            })}`}
            className={buttonClasses({ variant: "brand", size: "lg" })}
          >
            See these rooms
          </Link>
        </section>
      )}

      {dateRanges.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-label text-xs uppercase tracking-[0.14em] text-ink-heading">
            {requestedName ? `${requestedName} is free for ${nights} night${nights === 1 ? "" : "s"} on` : `Your group can stay for ${nights} night${nights === 1 ? "" : "s"} on`}
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

function TooManyGuests() {
  return (
    <p className="border border-forest/20 bg-white p-5 text-ink">
      We can seat up to {BOOKING.maxRoomsPerRequest} rooms per online request, and none of those combinations holds a group this
      size. For a bigger group, please{" "}
      <Link href="/enquiry" className="text-forest underline underline-offset-4">
        send us an enquiry
      </Link>
      .
    </p>
  );
}
