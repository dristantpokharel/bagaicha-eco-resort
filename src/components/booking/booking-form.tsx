"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/form";
import { TurnstileWidget } from "@/components/forms/turnstile-widget";
import { Placeholder } from "@/components/site/placeholder";
import { BOOKING } from "@/config/booking";
import { submitBookingRequest, type BookingRequestState } from "@/app/book/actions";

type Props = {
  stay: { checkIn: string; checkOut: string; adults: number; children: number; roomTypeId: string };
  defaultCountryCode: string;
  /** Server-rendered stay recap, shown beside the form and after success. */
  summary: ReactNode;
};

/** Guest details + submit. The server recomputes price and availability; nothing priced is posted. */
export function BookingForm({ stay, defaultCountryCode, summary }: Props) {
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [state, action, pending] = useActionState<BookingRequestState, FormData>(async (prev, formData) => {
    const result = await submitBookingRequest(prev, formData);
    // A Turnstile token is single-use: get a fresh one after every attempt.
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
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4" role="status">
          <h2 className="font-display text-2xl font-semibold italic text-ink-heading">Request received</h2>
          <p className="text-ink">Your booking number is</p>
          <p className="font-label text-3xl font-semibold tracking-wide text-forest">{state.bookingNumber}</p>
          <p className="text-ink">
            This is a request, not a confirmed booking yet. We will check availability and confirm by email or phone. Keep
            your booking number if you contact us.
          </p>
          {state.confirmationEmail === "sent" ? (
            <p className="text-ink">We&apos;ve emailed you a copy of your request.</p>
          ) : (
            <p className="text-ink">
              We couldn&apos;t send the confirmation email, but your request is saved. Please note your booking number.
            </p>
          )}
          <p className="text-sm text-ink-muted">
            Cancellation policy: {BOOKING.cancellationPolicy.isPlaceholder ? <Placeholder>{BOOKING.cancellationPolicy.text}</Placeholder> : BOOKING.cancellationPolicy.text}
          </p>
        </div>
        <div>{summary}</div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="order-2 lg:order-1">
      <form action={action} className="space-y-5" noValidate>
        {(Object.entries(stay) as [string, string | number][]).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {state && !state.ok && <FormMessage type="error">{state.error}</FormMessage>}

        <Field id="name" label="Full name" error={errors?.name}>
          <Input id="name" name="name" autoComplete="name" required maxLength={100} defaultValue={values?.name} className="h-12!" {...a11y("name")} />
        </Field>
        <Field id="email" label="Email" error={errors?.email} hint="We send your request confirmation here.">
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required defaultValue={values?.email} className="h-12!" {...a11y("email")} />
        </Field>
        <Field id="phone" label="Phone (WhatsApp if possible)" error={errors?.phone}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            required
            defaultValue={values?.phone || `${defaultCountryCode} `}
            className="h-12!"
            {...a11y("phone")}
          />
        </Field>
        <Field id="country" label="Country (optional)" error={errors?.country}>
          <Input id="country" name="country" autoComplete="country-name" maxLength={60} defaultValue={values?.country} className="h-12!" {...a11y("country")} />
        </Field>
        <Field id="specialRequests" label="Special requests (optional)" error={errors?.specialRequests}>
          <Textarea id="specialRequests" name="specialRequests" rows={4} maxLength={1000} defaultValue={values?.specialRequests} className="text-base" {...a11y("specialRequests")} />
        </Field>

        <TurnstileWidget action="booking" resetKey={attempt} onReadyChange={setReady} />

        <Button type="submit" variant="brand" size="lg" className="w-full sm:w-auto" disabled={pending || !ready}>
          {pending ? "Sending your request…" : ready ? "Send booking request" : "Checking security…"}
        </Button>
        <p className="text-sm text-ink-muted">This is a request, not a confirmed booking. We will confirm by email or phone.</p>
      </form>
      </div>
      <div className="order-1 lg:order-2">{summary}</div>
    </div>
  );
}
