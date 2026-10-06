"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input, Textarea } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import { updateGuest } from "../actions";

export function GuestForm({
  guest,
}: {
  guest: { id: string; name: string; phone: string; email: string; country: string; notes: string };
}) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(updateGuest, null);
  const errors = result && !result.ok ? result.fieldErrors : undefined;
  const a11y = (name: string) => ({
    "aria-invalid": errors?.[name] ? true : undefined,
    "aria-describedby": errors?.[name] ? `guest-${name}-error` : undefined,
  });

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="guestId" value={guest.id} />
      <ActionMessage result={result} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="guest-name" label="Name" error={errors?.name}>
          <Input id="guest-name" name="name" required maxLength={100} defaultValue={guest.name} {...a11y("name")} />
        </Field>
        <Field id="guest-phone" label="Phone" error={errors?.phone}>
          <Input id="guest-phone" name="phone" type="tel" inputMode="tel" defaultValue={guest.phone} {...a11y("phone")} />
        </Field>
        <Field id="guest-email" label="Email" error={errors?.email}>
          <Input id="guest-email" name="email" type="email" defaultValue={guest.email} {...a11y("email")} />
        </Field>
        <Field id="guest-country" label="Country" error={errors?.country}>
          <Input id="guest-country" name="country" maxLength={60} defaultValue={guest.country} {...a11y("country")} />
        </Field>
      </div>
      <Field id="guest-notes" label="Notes" error={errors?.notes} hint="Only staff see these.">
        <Textarea id="guest-notes" name="notes" rows={3} maxLength={2000} defaultValue={guest.notes} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save guest"}
      </Button>
    </form>
  );
}
