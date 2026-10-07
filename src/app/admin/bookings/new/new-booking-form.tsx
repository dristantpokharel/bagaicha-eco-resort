"use client";

import { describeCapacityShort } from "@/lib/booking/capacity";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import { createManualBooking } from "../actions";

type RoomTypeOption = {
  id: string;
  name: string;
  maxGuests: number;
  maxAdults: number;
  maxChildren: number | null;
  rooms: { id: string; name: string }[];
};

type Row = { key: string; roomTypeId: string; roomId: string; adults: number; children: number };
const blankRow = (key: string, roomTypeId: string): Row => ({ key, roomTypeId, roomId: "", adults: 2, children: 0 });

/** Phone / walk-in booking for one or more rooms. Only name and phone are required for the guest. */
export function NewBookingForm({
  roomTypes,
  defaultCountryCode,
  childUnderAge,
}: {
  roomTypes: RoomTypeOption[];
  defaultCountryCode: string;
  childUnderAge: number;
}) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(createManualBooking, null);
  const [rows, setRows] = useState<Row[]>(() => [blankRow("row-0", roomTypes[0]?.id ?? "")]);
  const rowCount = useRef(1);
  const update = (key: string, patch: Partial<Row>) => setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const errors = result && !result.ok ? result.fieldErrors : undefined;
  const a11y = (name: string) => ({
    "aria-invalid": errors?.[name] ? true : undefined,
    "aria-describedby": errors?.[name] ? `new-${name}-error` : undefined,
  });

  return (
    <form action={action} className="max-w-3xl space-y-6" noValidate>
      <ActionMessage result={result} />

      <fieldset className="space-y-4 rounded-lg border border-forest/10 bg-white p-5">
        <legend className="px-1 font-display text-lg text-forest">Stay</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="new-checkIn" label="Check-in" error={errors?.checkIn}>
            <Input id="new-checkIn" name="checkIn" type="date" required {...a11y("checkIn")} />
          </Field>
          <Field id="new-checkOut" label="Check-out" error={errors?.checkOut}>
            <Input id="new-checkOut" name="checkOut" type="date" required {...a11y("checkOut")} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-forest/10 bg-white p-5">
        <legend className="px-1 font-display text-lg text-forest">Rooms</legend>
        <input type="hidden" name="rooms" value={JSON.stringify(rows.map(({ roomTypeId, roomId, adults, children }) => ({ roomTypeId, roomId: roomId || null, adults, children })))} />
        <p className="text-xs text-charcoal-light">
          Every room is for the dates above. Choosing a room confirms that room straight away; leave it empty to keep it pending.
        </p>
        {errors?.rooms && (
          <p className="text-sm text-error" role="alert">
            {errors.rooms}
          </p>
        )}
        <ul className="space-y-4">
          {rows.map((row, i) => {
            const type = roomTypes.find((rt) => rt.id === row.roomTypeId);
            return (
              <li key={row.key} className="grid gap-3 border border-forest/10 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field id={`new-type-${row.key}`} label={`Room ${i + 1} type`}>
                  <Select id={`new-type-${row.key}`} value={row.roomTypeId} onChange={(e) => update(row.key, { roomTypeId: e.target.value, roomId: "" })}>
                    {roomTypes.map((rt) => (
                      <option key={rt.id} value={rt.id}>
                        {rt.name} ({describeCapacityShort(rt)})
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id={`new-room-${row.key}`} label="Assign a room (optional)">
                  <Select id={`new-room-${row.key}`} value={row.roomId} onChange={(e) => update(row.key, { roomId: e.target.value })}>
                    <option value="">Not yet: keep pending</option>
                    {(type?.rooms ?? []).map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id={`new-adults-${row.key}`} label="Adults">
                  <Input id={`new-adults-${row.key}`} type="number" min={1} max={20} value={row.adults} onChange={(e) => update(row.key, { adults: Number(e.target.value) })} />
                </Field>
                <Field id={`new-children-${row.key}`} label={`Children under ${childUnderAge}`}>
                  <div className="flex items-start gap-2">
                    <Input id={`new-children-${row.key}`} type="number" min={0} max={20} value={row.children} onChange={(e) => update(row.key, { children: Number(e.target.value) })} />
                    {rows.length > 1 && (
                      <Button type="button" variant="ghost" size="md" onClick={() => setRows((all) => all.filter((r) => r.key !== row.key))} aria-label={`Remove room ${i + 1}`}>
                        Remove
                      </Button>
                    )}
                  </div>
                </Field>
              </li>
            );
          })}
        </ul>
        <Button type="button" variant="secondary" onClick={() => setRows((all) => [...all, blankRow(`row-${rowCount.current++}`, roomTypes[0]?.id ?? "")])}>
          Add another room
        </Button>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-forest/10 bg-white p-5">
        <legend className="px-1 font-display text-lg text-forest">Guest</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="new-name" label="Name" error={errors?.name}>
            <Input id="new-name" name="name" required maxLength={100} autoComplete="off" {...a11y("name")} />
          </Field>
          <Field id="new-phone" label="Phone" error={errors?.phone} hint="Saved with the country code.">
            <Input id="new-phone" name="phone" type="tel" inputMode="tel" required defaultValue={`${defaultCountryCode} `} {...a11y("phone")} />
          </Field>
          <Field id="new-email" label="Email (optional)" error={errors?.email} hint="Without an email, no confirmation is sent to the guest.">
            <Input id="new-email" name="email" type="email" {...a11y("email")} />
          </Field>
          <Field id="new-country" label="Country (optional)" error={errors?.country}>
            <Input id="new-country" name="country" maxLength={60} {...a11y("country")} />
          </Field>
        </div>
        <p className="text-xs text-charcoal-light">
          If a guest with the same email or phone already exists, this booking is added to their history.
        </p>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-forest/10 bg-white p-5">
        <legend className="px-1 font-display text-lg text-forest">Details</legend>
        <Field id="new-source" label="How did it come in?" error={errors?.source}>
          <Select id="new-source" name="source" defaultValue="PHONE" {...a11y("source")}>
            <option value="PHONE">Phone</option>
            <option value="WALK_IN">Walk-in</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field id="new-requests" label="Guest's special requests" error={errors?.specialRequests}>
          <Textarea id="new-requests" name="specialRequests" rows={3} maxLength={1000} />
        </Field>
        <Field id="new-notes" label="Internal notes" error={errors?.internalNotes} hint="Only staff see these.">
          <Textarea id="new-notes" name="internalNotes" rows={3} maxLength={2000} />
        </Field>
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create booking"}
      </Button>
    </form>
  );
}
