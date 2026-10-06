"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { addDays, parseDateOnly, toDateOnlyString } from "@/lib/booking/dates";

type Props = {
  today: string;
  maxGuests: number;
  childUnderAge: number;
  defaults: { checkIn: string; checkOut: string; adults: number; children: number };
  errors?: Record<string, string>;
  /** Room type slug chosen on /stay; kept through the search so the room is preselected. */
  room?: string;
};

/** Dates + party. Plain GET form, so results are a normal, shareable URL. */
export function SearchForm({ today, maxGuests, childUnderAge, defaults, errors, room }: Props) {
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);

  const nextDay = (value: string) => {
    const date = parseDateOnly(value);
    return date ? toDateOnlyString(addDays(date, 1)) : today;
  };

  function onCheckInChange(value: string) {
    setCheckIn(value);
    // Keep check-out after check-in: move it to the next day when it would be invalid.
    if (!checkOut || checkOut <= value) setCheckOut(nextDay(value));
  }

  const counts = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i).map((n) => (
      <option key={n} value={n}>
        {n}
      </option>
    ));

  return (
    <form action="/book" method="get" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end" noValidate>
      {room && <input type="hidden" name="room" value={room} />}
      <Field id="checkIn" label="Check-in" error={errors?.checkIn}>
        <Input
          id="checkIn"
          name="checkIn"
          type="date"
          required
          min={today}
          value={checkIn}
          onChange={(e) => onCheckInChange(e.target.value)}
          className="h-12!"
          aria-invalid={errors?.checkIn ? true : undefined}
        />
      </Field>
      <Field id="checkOut" label="Check-out" error={errors?.checkOut}>
        <Input
          id="checkOut"
          name="checkOut"
          type="date"
          required
          min={checkIn ? nextDay(checkIn) : today}
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
          className="h-12!"
          aria-invalid={errors?.checkOut ? true : undefined}
        />
      </Field>
      <Field id="adults" label="Adults (incl. children 8+)" error={errors?.adults}>
        <Select id="adults" name="adults" defaultValue={defaults.adults} className="h-12!">
          {counts(1, maxGuests)}
        </Select>
      </Field>
      <Field id="children" label={`Children under ${childUnderAge}`} error={errors?.children}>
        <Select id="children" name="children" defaultValue={defaults.children} className="h-12!">
          {counts(0, Math.max(maxGuests - 1, 0))}
        </Select>
      </Field>
      <Button type="submit" variant="brand" size="lg" className="sm:col-span-2 lg:col-span-1">
        Check availability
      </Button>
    </form>
  );
}
