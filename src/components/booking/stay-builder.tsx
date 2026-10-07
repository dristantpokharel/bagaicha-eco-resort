"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { BOOKING } from "@/config/booking";
import { Button, buttonClasses } from "@/components/ui/button";
import { DateRangeField } from "@/components/booking/date-range-field";
import { RoomRow } from "@/components/booking/room-row";
import { addDays, nightsBetween, parseDateOnly } from "@/lib/booking/dates";
import { latestCheckOut, soldOutForRooms, type AvailabilityPayload } from "@/lib/booking/availability-map";
import { quoteLines } from "@/lib/booking/pricing";
import { checkRooms, DEFAULT_PARTY, quoteRooms, type BuilderRoom, type BuilderType } from "@/lib/booking/room-builder";
import { encodeRooms } from "@/lib/booking/selection-url";
import { formatNpr } from "@/lib/money";

type Props = {
  today: string;
  childUnderAge: number;
  types: BuilderType[];
  /** From the URL, already sanitised by the server. */
  initial: { checkIn: string; checkOut: string; rooms: BuilderRoom[] };
  /** Rooms free for the whole stay by type slug, for the dates the server last rendered (`freeFor`, "in|out"). */
  free: Record<string, number> | null;
  freeFor: string;
  /** Problem with the dates in the URL, from the server's stay rules. */
  dateError?: string;
  notice?: string;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Build your stay": dates, then one row per room (type + guests), a live summary and Continue. */
export function StayBuilder({ today, childUnderAge, types, initial, free, freeFor, dateError, notice }: Props) {
  const router = useRouter();
  const [checking, startTransition] = useTransition();
  const [checkIn, setCheckIn] = useState(initial.checkIn);
  const [checkOut, setCheckOut] = useState(initial.checkOut);
  const [rooms, setRooms] = useState<BuilderRoom[]>(initial.rooms);
  const [payload, setPayload] = useState<AvailabilityPayload | null>(null);
  const max = BOOKING.maxRoomsPerRequest;

  // Sold-out nights are a nicety: if the request fails the calendar still works and the server re-checks on submit.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/availability", { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<AvailabilityPayload>) : null))
      .then(setPayload)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const byTypeSlug = useMemo(() => new Map(types.map((t) => [t.slug, t])), [types]);
  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    params.set("rooms", encodeRooms(rooms));
    return params;
  }, [checkIn, checkOut, rooms]);

  // Keep the URL in step with the form. New dates go through the router so the server returns the rooms free for
  // them; everything else just rewrites the address.
  const datesKey = `${checkIn}|${checkOut}`;
  const datesSet = Boolean(checkIn && checkOut);
  useEffect(() => {
    const url = `/book?${query}`;
    if (datesSet && datesKey !== freeFor) startTransition(() => router.replace(url, { scroll: false }));
    else window.history.replaceState(null, "", url);
  }, [query, datesSet, datesKey, freeFor, router]);

  const stayFree = useMemo(() => (datesSet && datesKey === freeFor && free ? new Map(types.map((t) => [t.slug, free[t.slug] ?? 0])) : null), [datesSet, datesKey, freeFor, free, types]);
  const inDate = parseDateOnly(checkIn);
  const outDate = parseDateOnly(checkOut);
  const nights = inDate && outDate ? nightsBetween(inDate, outDate) : 0;

  const chosen = rooms.flatMap((r) => (r.slug ? [r.slug] : [])).join(",");
  const soldOut = useMemo(() => (payload ? soldOutForRooms(payload, chosen ? chosen.split(",") : []) : new Set<string>()), [payload, chosen]);
  const crossesSoldOut =
    inDate && outDate && payload ? latestCheckOut(soldOut, inDate, BOOKING.maxNights, addDays(parseDateOnly(today) as Date, BOOKING.maxDaysAhead)) < outDate : false;

  const check = checkRooms(rooms, byTypeSlug, stayFree, max);
  const quote = nights > 0 ? quoteRooms(rooms, byTypeSlug, nights) : null;
  const ready = check.ok && stayFree !== null && nights > 0 && !crossesSoldOut;
  const atLimit = rooms.length >= max;

  const update = (i: number, room: BuilderRoom) => setRooms((all) => all.map((r, k) => (k === i ? room : r)));
  const continueQuery = new URLSearchParams(query);
  continueQuery.set("step", "details");

  return (
    <div className="space-y-8">
      {notice && (
        <p className="border-l-4 border-warning bg-white px-4 py-3 text-ink" role="status">
          {notice}
        </p>
      )}

      <div className="border border-forest/20 bg-white p-5">
        <div className="max-w-xl">
          <DateRangeField
            today={today}
            checkIn={checkIn}
            checkOut={checkOut}
            onChange={(i, o) => {
              setCheckIn(i);
              setCheckOut(o);
            }}
            soldOut={soldOut}
            error={datesKey === freeFor ? dateError : undefined}
            notice={crossesSoldOut ? "These dates include a night when your chosen rooms aren't all free. Try other dates." : undefined}
          />
          <p className="mt-1 min-h-4 text-xs text-ink-muted" aria-live="polite">
            {checking ? "Checking availability…" : ""}
          </p>
        </div>
      </div>

      <section className="space-y-4" aria-labelledby="rooms-heading">
        <h2 id="rooms-heading" className="font-display text-2xl font-semibold italic text-ink-heading">
          Your rooms
        </h2>
        <ul className="space-y-4">
          {rooms.map((_, i) => (
            <RoomRow
              key={i}
              index={i}
              rooms={rooms}
              types={types}
              free={stayFree}
              childUnderAge={childUnderAge}
              onChange={(room) => update(i, room)}
              onRemove={i > 0 ? () => setRooms((all) => all.filter((_, k) => k !== i)) : undefined}
            />
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="brand-outline" size="lg" className="text-forest" disabled={atLimit} onClick={() => setRooms((all) => [...all, { slug: null, ...DEFAULT_PARTY }])}>
            + Add room
          </Button>
          <p className="text-sm text-ink-muted">{atLimit ? `That's the most we take online (${max} rooms).` : `Up to ${max} rooms online.`}</p>
        </div>

        <div
          className={`flex flex-wrap items-center justify-between gap-4 border p-4 sm:p-5 ${atLimit ? "border-forest bg-sage" : "border-forest/20 bg-white"}`}
        >
          <p className="max-w-xl text-ink">Planning for a bigger group or event? Send us an enquiry and we&apos;ll get back to you with a plan.</p>
          <Link href="/enquiry?type=STAY" className={buttonClasses({ variant: atLimit ? "brand" : "brand-outline", size: "lg", className: atLimit ? "" : "text-forest" })}>
            Enquire
          </Link>
        </div>
      </section>

      <section className="space-y-4 border border-forest/20 bg-white p-5" aria-labelledby="summary-heading" aria-live="polite">
        <h2 id="summary-heading" className="font-display text-2xl font-semibold italic text-ink-heading">
          Your stay
        </h2>
        {!datesSet && <p className="text-ink-muted">Choose your dates to see availability and prices.</p>}
        <ul className="divide-y divide-forest/15">
          {rooms.map((room, i) => {
            const line = quote?.lines[i];
            const problem = check.problems[i];
            return (
              <li key={i} className="space-y-1 py-3 text-sm first:pt-0">
                <p className="font-medium text-ink-heading">
                  Room {i + 1}: {room.slug ? (byTypeSlug.get(room.slug)?.name ?? "Unavailable") : "Choose a room type"}
                </p>
                <p className="text-ink">
                  {plural(room.adults, "adult", "adults")}
                  {room.children > 0 ? `, ${plural(room.children, "child", "children")} under ${childUnderAge}` : ""}
                </p>
                {line && (
                  <div className="text-ink-muted">
                    {quoteLines(line.quote, formatNpr).map((l) => (
                      <p key={l}>{l}</p>
                    ))}
                    <p className="text-ink">Room total: {formatNpr(line.quote.totalPriceNpr)}</p>
                  </div>
                )}
                {room.slug && problem && (
                  <p className="text-error" role="alert">
                    {problem}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-forest/15 pt-4">
          <p className="text-lg font-semibold text-ink">Total: {quote && quote.lines.some(Boolean) ? formatNpr(quote.totalPriceNpr) : "—"}</p>
          {ready ? (
            <Link href={`/book?${continueQuery}`} className={buttonClasses({ variant: "brand", size: "lg" })}>
              Continue
            </Link>
          ) : (
            <Button type="button" variant="brand" size="lg" disabled>
              Continue
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
