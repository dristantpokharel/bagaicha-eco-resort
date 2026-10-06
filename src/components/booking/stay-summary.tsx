import { BOOKING } from "@/config/booking";
import { formatStayDate } from "@/lib/booking/dates";
import { quoteLines, type Quote } from "@/lib/booking/pricing";
import { formatNpr } from "@/lib/money";

/** Read-only stay recap with the price breakdown. Display only: the server recomputes on submit. */
export function StaySummary({
  roomTypeName,
  checkIn,
  checkOut,
  adults,
  childCount,
  quote,
}: {
  roomTypeName: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  childCount: number;
  quote: Quote;
}) {
  const lines = quoteLines(quote, formatNpr);
  return (
    <section aria-label="Your stay" className="border border-forest/20 bg-white p-5">
      <h2 className="font-display text-xl font-semibold italic text-ink-heading">{roomTypeName}</h2>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-ink-muted">Check-in</dt>
          <dd className="text-ink">
            {formatStayDate(checkIn)}, from {BOOKING.checkInTime}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Check-out</dt>
          <dd className="text-ink">
            {formatStayDate(checkOut)}, by {BOOKING.checkOutTime}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Guests</dt>
          <dd className="text-ink">
            {adults} adult{adults === 1 ? "" : "s"}
            {childCount > 0 ? `, ${childCount} child${childCount === 1 ? "" : "ren"} under ${BOOKING.childUnderAge}` : ""}
          </dd>
        </div>
      </dl>
      <div className="mt-4 border-t border-forest/15 pt-4 text-sm">
        {lines.map((line) => (
          <p key={line} className="text-ink-muted">
            {line}
          </p>
        ))}
        <p className="mt-2 text-base font-semibold text-ink">Total: {formatNpr(quote.totalPriceNpr)}</p>
      </div>
    </section>
  );
}
