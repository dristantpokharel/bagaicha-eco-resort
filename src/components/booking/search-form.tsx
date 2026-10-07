"use client";

import { useEffect, useMemo, useState } from "react";
import { BOOKING } from "@/config/booking";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { DateRangeField } from "@/components/booking/date-range-field";
import { addDays, parseDateOnly } from "@/lib/booking/dates";
import { latestCheckOut, soldOutForSelection, type AvailabilityPayload } from "@/lib/booking/availability-map";

type Props = {
  today: string;
  maxGuests: number;
  childUnderAge: number;
  roomTypes: { slug: string; name: string; maxGuests: number }[];
  defaults: { checkIn: string; checkOut: string; adults: number; children: number };
  errors?: Record<string, string>;
  /** Room type slug chosen on /stay or in a previous search; "" means any room. */
  room?: string;
};

/** Room type + dates + party. Plain GET form, so results are a normal, shareable URL. */
export function SearchForm({ today, maxGuests, childUnderAge, roomTypes, defaults, errors, room: initialRoom }: Props) {
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [room, setRoom] = useState(roomTypes.some((r) => r.slug === initialRoom) ? (initialRoom as string) : "");
  const [adults, setAdults] = useState(defaults.adults);
  const [children, setChildren] = useState(defaults.children);
  const [payload, setPayload] = useState<AvailabilityPayload | null>(null);

  // Sold-out nights are a nicety: if the request fails the calendar still works and the server re-checks on submit.
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/availability", { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<AvailabilityPayload>) : null))
      .then(setPayload)
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  const party = adults + children;
  const soldOut = useMemo(
    () => (payload ? soldOutForSelection(payload, room || null, party) : new Set<string>()),
    [payload, room, party],
  );

  const selectedType = roomTypes.find((r) => r.slug === room);
  const tooSmall = selectedType && selectedType.maxGuests < party;

  const inDate = parseDateOnly(checkIn);
  const outDate = parseDateOnly(checkOut);
  const crossesSoldOut =
    inDate && outDate && payload
      ? latestCheckOut(soldOut, inDate, BOOKING.maxNights, addDays(parseDateOnly(today) as Date, BOOKING.maxDaysAhead)) < outDate
      : false;

  const counts = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i).map((n) => (
      <option key={n} value={n}>
        {n}
      </option>
    ));

  return (
    <form action="/book" method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-start" noValidate>
      <div className="sm:col-span-2 lg:col-span-6 lg:max-w-sm">
        <Field
          id="room"
          label="Room type (optional)"
          hint={tooSmall ? `${selectedType.name} sleeps up to ${selectedType.maxGuests} guests, children included.` : undefined}
        >
          <Select id="room" name="room" value={room} onChange={(e) => setRoom(e.target.value)} className="h-12!">
            <option value="">Any room</option>
            {roomTypes.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="sm:col-span-2 lg:col-span-2">
        <DateRangeField
          today={today}
          checkIn={checkIn}
          checkOut={checkOut}
          onChange={(i, o) => {
            setCheckIn(i);
            setCheckOut(o);
          }}
          soldOut={soldOut}
          error={errors?.checkIn ?? errors?.checkOut}
          notice={crossesSoldOut ? "These dates include a sold-out night for this selection. Try other dates." : undefined}
        />
        <noscript>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Input name="checkIn" type="date" aria-label="Check-in" min={today} defaultValue={defaults.checkIn} />
            <Input name="checkOut" type="date" aria-label="Check-out" min={today} defaultValue={defaults.checkOut} />
          </div>
        </noscript>
      </div>
      <Field id="adults" label="Adults (incl. children 8+)" error={errors?.adults}>
        <Select id="adults" name="adults" value={adults} onChange={(e) => setAdults(Number(e.target.value))} className="h-12!">
          {counts(1, maxGuests)}
        </Select>
      </Field>
      <Field id="children" label={`Children under ${childUnderAge}`} error={errors?.children}>
        <Select id="children" name="children" value={children} onChange={(e) => setChildren(Number(e.target.value))} className="h-12!">
          {counts(0, Math.max(maxGuests - 1, 0))}
        </Select>
      </Field>
      <div className="sm:col-span-2 lg:col-span-1 lg:self-end">
        <Button type="submit" variant="brand" size="lg" className="w-full">
          Check availability
        </Button>
      </div>
    </form>
  );
}
