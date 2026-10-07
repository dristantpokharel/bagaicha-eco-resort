"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import type { EditableFlags } from "@/lib/booking/status";
import { updateBooking } from "../actions";

export type EditValues = {
  bookingId: string;
  roomTypeId: string;
  roomId: string | null;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  specialRequests: string;
  internalNotes: string;
};

/** Only the parts allowed for the booking's status are editable; the server enforces the same rules. */
export function BookingEditForm({
  values,
  flags,
  roomTypes,
  rooms,
  childUnderAge,
}: {
  values: EditValues;
  flags: EditableFlags;
  roomTypes: { id: string; name: string }[];
  /** Rooms the booking can be moved to (CONFIRMED only). */
  rooms: { id: string; name: string }[];
  childUnderAge: number;
}) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(updateBooking, null);
  const errors = result && !result.ok ? result.fieldErrors : undefined;
  const a11y = (name: string) => ({
    "aria-invalid": errors?.[name] ? true : undefined,
    "aria-describedby": errors?.[name] ? `edit-${name}-error` : undefined,
  });
  const anyStayField = flags.checkIn || flags.checkOut || flags.party || flags.roomType || flags.room;

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="bookingId" value={values.bookingId} />
      <ActionMessage result={result} />

      {anyStayField && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {flags.checkIn && (
            <Field id="edit-checkIn" label="Check-in" error={errors?.checkIn}>
              <Input id="edit-checkIn" name="checkIn" type="date" defaultValue={values.checkIn} required {...a11y("checkIn")} />
            </Field>
          )}
          {flags.checkOut && (
            <Field id="edit-checkOut" label="Check-out" error={errors?.checkOut}>
              <Input id="edit-checkOut" name="checkOut" type="date" defaultValue={values.checkOut} required {...a11y("checkOut")} />
            </Field>
          )}
          {flags.party && (
            <>
              <Field id="edit-adults" label={`Adults (incl. children ${childUnderAge}+)`} error={errors?.adults}>
                <Input id="edit-adults" name="adults" type="number" min={1} max={20} defaultValue={values.adults} {...a11y("adults")} />
              </Field>
              <Field id="edit-children" label={`Children under ${childUnderAge}`} error={errors?.children}>
                <Input id="edit-children" name="children" type="number" min={0} max={20} defaultValue={values.children} {...a11y("children")} />
              </Field>
            </>
          )}
          {flags.roomType && (
            <Field id="edit-roomType" label="Room type" hint="Changing it reprices with the new type's current rates.">
              <Select id="edit-roomType" name="roomTypeId" defaultValue={values.roomTypeId}>
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {flags.room && (
            <Field id="edit-room" label="Room" hint="Free rooms of this type for these dates.">
              <Select id="edit-room" name="roomId" defaultValue={values.roomId ?? ""}>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      )}

      {flags.guestRequests && (
        <Field id="edit-requests" label="Guest's special requests" error={errors?.specialRequests}>
          <Textarea id="edit-requests" name="specialRequests" rows={3} maxLength={1000} defaultValue={values.specialRequests} />
        </Field>
      )}
      <Field id="edit-notes" label="Internal notes" error={errors?.internalNotes} hint="Only staff see these.">
        <Textarea id="edit-notes" name="internalNotes" rows={3} maxLength={2000} defaultValue={values.internalNotes} />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
