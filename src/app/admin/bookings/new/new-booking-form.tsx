"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import { createManualBooking } from "../actions";

type RoomTypeOption = {
  id: string;
  name: string;
  maxGuests: number;
  rooms: { id: string; name: string }[];
};

/** Phone / walk-in booking. Only name and phone are required for the guest. */
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
  const [roomTypeId, setRoomTypeId] = useState(roomTypes[0]?.id ?? "");
  const errors = result && !result.ok ? result.fieldErrors : undefined;
  const a11y = (name: string) => ({
    "aria-invalid": errors?.[name] ? true : undefined,
    "aria-describedby": errors?.[name] ? `new-${name}-error` : undefined,
  });
  const rooms = roomTypes.find((rt) => rt.id === roomTypeId)?.rooms ?? [];

  return (
    <form action={action} className="max-w-3xl space-y-6" noValidate>
      <ActionMessage result={result} />

      <fieldset className="space-y-4 rounded-lg border border-forest/10 bg-white p-5">
        <legend className="px-1 font-display text-lg text-forest">Stay</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="new-roomTypeId" label="Room type" error={errors?.roomTypeId}>
            <Select id="new-roomTypeId" name="roomTypeId" value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)} {...a11y("roomTypeId")}>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name} (up to {rt.maxGuests})
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id="new-roomId"
            label="Assign a room (optional)"
            hint="Leave empty to save as a pending request. Choosing a room confirms the booking."
          >
            <Select id="new-roomId" name="roomId" defaultValue="" key={roomTypeId}>
              <option value="">Not yet: keep pending</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="new-checkIn" label="Check-in" error={errors?.checkIn}>
            <Input id="new-checkIn" name="checkIn" type="date" required {...a11y("checkIn")} />
          </Field>
          <Field id="new-checkOut" label="Check-out" error={errors?.checkOut}>
            <Input id="new-checkOut" name="checkOut" type="date" required {...a11y("checkOut")} />
          </Field>
          <Field id="new-adults" label={`Adults (incl. children ${childUnderAge}+)`} error={errors?.adults}>
            <Input id="new-adults" name="adults" type="number" min={1} max={20} defaultValue={2} {...a11y("adults")} />
          </Field>
          <Field id="new-children" label={`Children under ${childUnderAge}`} error={errors?.children}>
            <Input id="new-children" name="children" type="number" min={0} max={20} defaultValue={0} {...a11y("children")} />
          </Field>
        </div>
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
