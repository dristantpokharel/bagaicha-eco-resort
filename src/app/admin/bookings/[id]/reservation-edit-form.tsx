"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input, Textarea } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import { updateReservation } from "../actions";

export type ReservationEditValues = {
  reservationId: string;
  checkIn: string;
  checkOut: string;
  specialRequests: string;
  internalNotes: string;
};

/** Dates move for every open room together. Which dates can change depends on the rooms' states; the server enforces the same. */
export function ReservationEditForm({ values, flags }: { values: ReservationEditValues; flags: { checkIn: boolean; checkOut: boolean } }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(updateReservation, null);
  const errors = result && !result.ok ? result.fieldErrors : undefined;
  const a11y = (name: string) => ({
    "aria-invalid": errors?.[name] ? true : undefined,
    "aria-describedby": errors?.[name] ? `edit-${name}-error` : undefined,
  });

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="reservationId" value={values.reservationId} />
      <ActionMessage result={result} />

      {(flags.checkIn || flags.checkOut) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {flags.checkIn && (
            <Field id="edit-checkIn" label="Check-in" error={errors?.checkIn} hint="Moves every open room.">
              <Input id="edit-checkIn" name="checkIn" type="date" defaultValue={values.checkIn} required {...a11y("checkIn")} />
            </Field>
          )}
          {flags.checkOut && (
            <Field id="edit-checkOut" label="Check-out" error={errors?.checkOut} hint="Moves every open room.">
              <Input id="edit-checkOut" name="checkOut" type="date" defaultValue={values.checkOut} required {...a11y("checkOut")} />
            </Field>
          )}
        </div>
      )}

      <Field id="edit-requests" label="Guest's special requests" error={errors?.specialRequests}>
        <Textarea id="edit-requests" name="specialRequests" rows={3} maxLength={1000} defaultValue={values.specialRequests} />
      </Field>
      <Field id="edit-notes" label="Internal notes" error={errors?.internalNotes} hint="Only staff see these.">
        <Textarea id="edit-notes" name="internalNotes" rows={3} maxLength={2000} defaultValue={values.internalNotes} />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
