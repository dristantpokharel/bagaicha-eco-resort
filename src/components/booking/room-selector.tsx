"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BOOKING } from "@/config/booking";
import { Button, buttonClasses } from "@/components/ui/button";
import { Stepper } from "@/components/booking/stepper";
import { describeCapacity, type Capacity } from "@/lib/booking/capacity";
import { quoteLines } from "@/lib/booking/pricing";
import { quoteReservation, splitParty, summariseRooms, validateSplit, type RoomLine } from "@/lib/booking/multi-room";
import { childAgeRange } from "@/lib/booking/party";
import { encodeLines } from "@/lib/booking/selection-url";
import { formatNpr } from "@/lib/money";

export type SelectorType = Capacity & {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** Distinct rooms free for the whole stay. */
  free: number;
  basePriceNpr: number;
  childPricePerNightNpr: number;
};

type Props = {
  types: SelectorType[];
  party: { adults: number; children: number };
  nights: number;
  childUnderAge: number;
  /** The search (dates, party), reused to build the link to the guest form. */
  params: Record<string, string>;
  /** Rooms per type to start with, by type id. */
  initialCounts: Record<string, number>;
  /** A working combination for a party that fits no single room, by type id. */
  suggestion: { counts: Record<string, number>; label: string } | null;
  /** Shown when an earlier selection (from a link) is no longer valid. */
  notice?: string;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One quantity per room type, a per-room guest split that starts even and can be edited, and the live price. */
export function RoomSelector({ types, party, nights, childUnderAge, params, initialCounts, suggestion, notice }: Props) {
  const max = BOOKING.maxRoomsPerRequest;
  const byId = useMemo(() => new Map<string, SelectorType>(types.map((t) => [t.id, t])), [types]);
  const [counts, setCounts] = useState<Record<string, number>>(() => clampCounts(initialCounts, types, max));
  const rooms = useMemo(() => types.flatMap((t) => Array<SelectorType>(counts[t.id] ?? 0).fill(t)), [types, counts]);
  const [lines, setLines] = useState<RoomLine[]>(() => split(rooms, party));

  const total = rooms.length;
  const validation = validateSplit(lines, byId, party);
  const quote = lines.length > 0 ? quoteReservation(lines, byId, nights) : null;

  function apply(next: Record<string, number>) {
    const clamped = clampCounts(next, types, max);
    setCounts(clamped);
    setLines(split(types.flatMap((t) => Array<SelectorType>(clamped[t.id] ?? 0).fill(t)), party));
  }
  const changeCount = (t: SelectorType, delta: 1 | -1) => apply({ ...counts, [t.id]: (counts[t.id] ?? 0) + delta });
  const stepGuests = (i: number, field: "adults" | "children", delta: 1 | -1) =>
    setLines((all) => all.map((l, k) => (k === i ? { ...l, [field]: Math.max(0, l[field] + delta) } : l)));

  const slugOf = (id: string) => byId.get(id)!.slug;
  const continueHref = `/book?${new URLSearchParams({
    ...params,
    lines: encodeLines(lines.map((l) => ({ slug: slugOf(l.roomTypeId), adults: l.adults, children: l.children }))),
  })}`;

  return (
    <div className="space-y-8">
      {notice && (
        <p className="border-l-4 border-warning bg-white px-4 py-3 text-ink" role="status">
          {notice}
        </p>
      )}

      {suggestion && (
        <div className="border border-forest/20 bg-sage p-5" role="status">
          <p className="font-medium text-ink-heading">
            Your group of {plural(party.adults, "adult", "adults")}
            {party.children > 0 ? ` and ${plural(party.children, "child", "children")}` : ""} doesn&apos;t fit in one room.
          </p>
          <p className="mt-1 text-ink">
            {suggestion.label} works for your dates.
          </p>
          <Button type="button" variant="brand" size="lg" className="mt-3" onClick={() => apply(suggestion.counts)}>
            Use this combination
          </Button>
        </div>
      )}

      <section className="space-y-4" aria-labelledby="rooms-heading">
        <h2 id="rooms-heading" className="font-display text-2xl font-semibold italic text-ink-heading">
          Choose your rooms
        </h2>
        <p className="text-sm text-ink-muted">
          Choose up to {max} rooms for the same dates. We&apos;ll share your group between them, and you can change who stays where.
        </p>
        <ul className="grid gap-5 md:grid-cols-2">
          {types.map((t) => {
            const n = counts[t.id] ?? 0;
            return (
              <li key={t.id} className={`flex flex-col border bg-white p-5 ${n > 0 ? "border-forest" : "border-forest/20"}`}>
                <h3 className="font-display text-xl font-semibold italic text-ink-heading">{t.name}</h3>
                <p className="mt-1 text-sm text-ink-muted">{describeCapacity(t, { childrenIncluded: true })}</p>
                {t.description && <p className="mt-3 text-sm text-ink">{t.description}</p>}
                <p className="mt-4 text-sm text-ink">
                  {formatNpr(t.basePriceNpr)} per night
                  {t.childPricePerNightNpr > 0 ? `, plus ${formatNpr(t.childPricePerNightNpr)} per child per night` : ""}
                </p>
                <div className="mt-4 flex items-center justify-between gap-4 border-t border-forest/15 pt-4">
                  <p className="text-sm text-ink-muted">
                    {t.free === 1 ? "1 room free" : `${t.free} rooms free`} for your stay
                  </p>
                  <Stepper
                    value={n}
                    canDecrease={n > 0}
                    canIncrease={n < t.free && total < max}
                    onStep={(d) => changeCount(t, d)}
                    noun={`${t.name} rooms`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        {total >= max && (
          <p className="text-sm text-ink-muted">
            That&apos;s the most we take online ({max} rooms). For a larger group, please{" "}
            <Link href="/enquiry" className="text-forest underline underline-offset-4">
              send an enquiry
            </Link>
            .
          </p>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="selection-heading" aria-live="polite">
        <h2 id="selection-heading" className="font-display text-2xl font-semibold italic text-ink-heading">
          Your selection
        </h2>
        {lines.length === 0 ? (
          <p className="text-ink">No rooms chosen yet. Use the + buttons above.</p>
        ) : (
          <>
            <ul className="divide-y divide-forest/15 border border-forest/20 bg-white">
              {lines.map((line, i) => {
                const type = byId.get(line.roomTypeId)!;
                const q = quote?.lines[i];
                const problem = validation.lineErrors[i];
                return (
                  <li key={i} className="space-y-3 p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-medium text-ink-heading">
                        Room {i + 1}: {type.name}
                      </h3>
                      {q && <p className="text-sm text-ink">Room total: {formatNpr(q.totalPriceNpr)}</p>}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <GuestRow label="Adults" noun={`adults in room ${i + 1}`} value={line.adults} onStep={(d) => stepGuests(i, "adults", d)} min={0} />
                      <GuestRow
                        label={`Children (${childAgeRange(childUnderAge)})`}
                        noun={`children in room ${i + 1}`}
                        value={line.children}
                        onStep={(d) => stepGuests(i, "children", d)}
                        min={0}
                      />
                    </div>
                    {q && (
                      <div className="text-sm text-ink-muted">
                        {quoteLines(q, formatNpr).map((l) => (
                          <p key={l}>{l}</p>
                        ))}
                      </div>
                    )}
                    {problem && (
                      <p className="text-sm text-error" role="alert">
                        {problem}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="text-sm text-forest underline underline-offset-4"
                onClick={() => setLines(split(rooms, party))}
              >
                Share the group evenly again
              </button>
            </div>
          </>
        )}

        {validation.errors.length > 0 && lines.length > 0 && (
          <ul className="space-y-1 text-sm text-error" role="alert">
            {validation.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-forest/15 pt-4">
          <div>
            <p className="text-sm text-ink-muted">{lines.length > 0 ? summariseRooms(lines.map((l) => byId.get(l.roomTypeId)!.name)) : ""}</p>
            <p className="text-lg font-semibold text-ink">Total: {formatNpr(quote?.totalPriceNpr ?? 0)}</p>
          </div>
          {validation.ok ? (
            <Link href={continueHref} className={buttonClasses({ variant: "brand", size: "lg" })}>
              Continue with {plural(lines.length, "room", "rooms")}
            </Link>
          ) : (
            <Button type="button" variant="brand" size="lg" disabled>
              {lines.length === 0 ? "Choose a room" : "Fix your selection"}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function GuestRow({ label, noun, value, onStep, min }: { label: string; noun: string; value: number; onStep: (d: 1 | -1) => void; min: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-ink">{label}</p>
      <Stepper value={value} canDecrease={value > min} canIncrease={value < 20} onStep={onStep} noun={noun} />
    </div>
  );
}

/** Never more than a type has free, and never more than the online limit across types. */
function clampCounts(counts: Record<string, number>, types: SelectorType[], max: number): Record<string, number> {
  const out: Record<string, number> = {};
  let left = max;
  for (const t of types) {
    const n = Math.max(0, Math.min(counts[t.id] ?? 0, t.free, left));
    if (n > 0) out[t.id] = n;
    left -= n;
  }
  return out;
}

function split(rooms: SelectorType[], party: { adults: number; children: number }): RoomLine[] {
  const shares = splitParty(party, rooms);
  return rooms.map((r, i) => ({ roomTypeId: r.id, ...shares[i] }));
}
