"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { TurnstileWidget } from "@/components/forms/turnstile-widget";
import { submitEnquiry, type EnquiryState } from "@/app/enquiry/actions";
import { ENQUIRY_TYPE_LABELS } from "@/lib/booking/labels";

export function EnquiryForm({ defaultType, defaultCountryCode }: { defaultType: string; defaultCountryCode: string }) {
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [state, action, pending] = useActionState<EnquiryState, FormData>(async (prev, formData) => {
    const result = await submitEnquiry(prev, formData);
    if (!result?.ok) setAttempt((n) => n + 1);
    return result;
  }, null);

  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const values = state && !state.ok ? state.values : undefined;
  const a11y = (name: string) => ({
    "aria-invalid": errors?.[name] ? true : undefined,
    "aria-describedby": errors?.[name] ? `${name}-error` : undefined,
  });

  if (state?.ok) {
    return (
      <div role="status" className="space-y-3">
        <h2 className="font-display text-2xl font-semibold italic text-ink-heading">Thank you</h2>
        <p className="text-ink">We&apos;ve received your enquiry and will get back to you soon.</p>
        <p>
          <Link href="/book" className="text-forest underline underline-offset-4">
            Looking for a regular stay? Check availability
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="max-w-xl space-y-5" noValidate>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      {state && !state.ok && <FormMessage type="error">{state.error}</FormMessage>}

      <Field id="name" label="Full name" error={errors?.name}>
        <Input id="name" name="name" autoComplete="name" required maxLength={100} defaultValue={values?.name} className="h-12!" {...a11y("name")} />
      </Field>
      <Field id="email" label="Email" error={errors?.email} hint="Email or phone: at least one, so we can reply.">
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={values?.email} className="h-12!" {...a11y("email")} />
      </Field>
      <Field id="phone" label="Phone (WhatsApp if possible)" error={errors?.phone}>
        <Input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          defaultValue={values?.phone ?? `${defaultCountryCode} `}
          className="h-12!"
          {...a11y("phone")}
        />
      </Field>
      <Field id="type" label="What is your enquiry about?" error={errors?.type}>
        <Select id="type" name="type" defaultValue={values?.type || defaultType} className="h-12!" {...a11y("type")}>
          {Object.entries(ENQUIRY_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="message" label="Your message" error={errors?.message}>
        <Textarea id="message" name="message" rows={6} required maxLength={3000} defaultValue={values?.message} className="text-base" {...a11y("message")} />
      </Field>

      <TurnstileWidget action="enquiry" resetKey={attempt} onReadyChange={setReady} />
      <Button type="submit" variant="brand" size="lg" className="w-full sm:w-auto" disabled={pending || !ready}>
        {pending ? "Sending…" : ready ? "Send enquiry" : "Checking security…"}
      </Button>
    </form>
  );
}
