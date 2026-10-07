"use client";

import { useEffect, useMemo, useState } from "react";
import { BOOKING } from "@/config/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { DateRangeField } from "@/components/booking/date-range-field";
import { GuestsField } from "@/components/booking/guests-field";
import { RoomTypePills } from "@/components/booking/room-type-pills";
import { describeCapacity, partyFits, type Capacity } from "@/lib/booking/capacity";
import { addDays, parseDateOnly } from "@/lib/booking/dates";
import { latestCheckOut, soldOutForSelection, type AvailabilityPayload } from "@/lib/booking/availability-map";

type Props = {
  today: string;
  childUnderAge: number;
  roomTypes: (Capacity & { slug: string; name: string })[];
  defaults: { checkIn: string; checkOut: string; adults: number; children: number };
  errors?: Record<string, string>;
  /** Room type slug chosen on /stay or in a previous search; "" means any room. */
  room?: string;
};

/** Room type + dates + party. Plain GET form, so results are a normal, shareable URL. */
export function SearchForm({ today, childUnderAge, roomTypes, defaults, errors, room: initialRoom }: Props) {
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [room, setRoom] = useState(roomTypes.some((r) => r.slug === initialRoom) ? (initialRoom as string) : "");
  const [party, setParty] = useState({ adults: defaults.adults, children: defaults.children });
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

  const soldOut = useMemo(
    () => (payload ? soldOutForSelection(payload, room || null, party) : new Set<string>()),
    [payload, room, party],
  );

  const selectedType = roomTypes.find((r) => r.slug === room);
  const tooSmall = selectedType && !partyFits(selectedType, party);
  const caps = selectedType ? [selectedType] : roomTypes;

  const inDate = parseDateOnly(checkIn);
  const outDate = parseDateOnly(checkOut);
  const crossesSoldOut =
    inDate && outDate && payload
      ? latestCheckOut(soldOut, inDate, BOOKING.maxNights, addDays(parseDateOnly(today) as Date, BOOKING.maxDaysAhead)) < outDate
      : false;

  return (
    <form action="/book" method="get" className="space-y-5" noValidate>
      <RoomTypePills
        roomTypes={roomTypes}
        value={room}
        onChange={setRoom}
        hint={tooSmall ? `${selectedType.name} doesn't fit this group: ${describeCapacity(selectedType).toLowerCase()}.` : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)_auto] lg:items-end">
        <div>
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
        <GuestsField party={party} onChange={setParty} caps={caps} typeName={selectedType?.name} childUnderAge={childUnderAge} error={errors?.adults ?? errors?.children} />
        <Button type="submit" variant="brand" size="lg" className="min-h-14 w-full lg:w-auto lg:px-8">
          Check availability
        </Button>
      </div>
    </form>
  );
}
