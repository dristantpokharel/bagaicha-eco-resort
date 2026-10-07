import { formatStayDate } from "@/lib/booking/dates";
import { quoteLines, type Quote } from "@/lib/booking/pricing";
import { formatNpr } from "@/lib/money";

export type SummaryRoom = { roomTypeName: string; adults: number; children: number; quote: Quote };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Read-only recap of the stay and every selected room, with each room's price and the grand total. Display only: the server recomputes on submit. */
export function StaySummary({
  rooms,
  checkIn,
  checkOut,
  checkInTime,
  checkOutTime,
  childUnderAge,
}: {
  rooms: SummaryRoom[];
  checkIn: Date;
  checkOut: Date;
  checkInTime: string | null;
  checkOutTime: string | null;
  childUnderAge: number;
}) {
  const total = rooms.reduce((n, r) => n + r.quote.totalPriceNpr, 0);
  return (
    <section aria-label="Your stay" className="border border-forest/20 bg-white p-5">
      <h2 className="font-display text-xl font-semibold italic text-ink-heading">Your stay</h2>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-ink-muted">Check-in</dt>
          <dd className="text-ink">
            {formatStayDate(checkIn)}
            {checkInTime ? `, from ${checkInTime}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Check-out</dt>
          <dd className="text-ink">
            {formatStayDate(checkOut)}
            {checkOutTime ? `, by ${checkOutTime}` : ""}
          </dd>
        </div>
      </dl>
      <ul className="mt-4 divide-y divide-forest/15 border-t border-forest/15 text-sm">
        {rooms.map((room, i) => (
          <li key={i} className="py-3">
            <p className="font-medium text-ink-heading">
              Room {i + 1}: {room.roomTypeName}
            </p>
            <p className="text-ink">
              {plural(room.adults, "adult", "adults")}
              {room.children > 0 ? `, ${plural(room.children, "child", "children")} under ${childUnderAge}` : ""}
            </p>
            <div className="mt-1">
              {quoteLines(room.quote, formatNpr).map((line) => (
                <p key={line} className="text-ink-muted">
                  {line}
                </p>
              ))}
              {rooms.length > 1 && <p className="text-ink">Room total: {formatNpr(room.quote.totalPriceNpr)}</p>}
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-forest/15 pt-3 text-base font-semibold text-ink">Total: {formatNpr(total)}</p>
    </section>
  );
}
