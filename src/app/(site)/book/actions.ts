"use server";

import { headers } from "next/headers";
import { db, BOOKING_TX_OPTIONS } from "@/lib/db";
import { logActivity } from "@/lib/activity-log";
import { ActionError } from "@/lib/actions";
import { todayInResort } from "@/lib/dates";
import { createBookingRecord } from "@/lib/booking/service";
import { validateStay } from "@/lib/booking/rules";
import { publicBookingSchema } from "@/lib/booking/schemas";
import { notifyBooking } from "@/lib/email/booking-emails";
import { clientIpFromHeaders, hitRateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { turnstileErrorMessage, verifyTurnstile } from "@/lib/turnstile";

export type BookingRequestState =
  | null
  | {
      ok: true;
      bookingNumber: string;
      /** "sent" | "failed" for the guest's email. */
      confirmationEmail: "sent" | "failed";
    }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string>;
      /** Echoed back so the form can refill itself (React clears forms after an action). */
      values?: Record<string, string>;
    };

const FORM_FIELDS = ["name", "email", "phone", "country", "specialRequests"] as const;

/** Public endpoint: creates a PENDING booking request. No sign-in; protected by Turnstile and rate limit. */
export async function submitBookingRequest(
  _prev: BookingRequestState,
  formData: FormData,
): Promise<BookingRequestState> {
  const values = Object.fromEntries(FORM_FIELDS.map((f) => [f, String(formData.get(f) ?? "")]));
  const fail = (error: string, fieldErrors?: Record<string, string>) =>
    ({ ok: false, error, fieldErrors, values }) as const;

  try {
    const parsed = publicBookingSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
      return fail("Please fix the highlighted fields.", fieldErrors);
    }
    const input = parsed.data;
    // Honeypot: a bot filled the hidden field. Look like a failure, save nothing.
    if (input.website) return fail("Something went wrong. Please reload the page and try again.");

    const roomType = await db.roomType.findFirst({ where: { id: input.roomTypeId, isActive: true } });
    if (!roomType) return fail("That room type isn't available any more. Please start again.");

    const stay = validateStay(input, { today: todayInResort(), publicRequest: true, capacity: roomType });
    if (!stay.ok) return fail(Object.values(stay.errors)[0], stay.errors);

    const ip = clientIpFromHeaders(await headers());
    const limit = await hitRateLimit("booking", ip);
    if (!limit.allowed) return fail(rateLimitMessage(limit.retryAfterSeconds));

    const human = await verifyTurnstile(input.turnstileToken, { ip, expectedAction: "booking" });
    if (!human.ok) return fail(turnstileErrorMessage(human.reason));

    const { booking } = await db.$transaction(async (tx) => {
      const created = await createBookingRecord(tx, {
        roomType,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        adults: input.adults,
        children: input.children,
        guest: { name: input.name, email: input.email, phone: input.phone, country: input.country },
        source: "WEBSITE",
        specialRequests: input.specialRequests,
        requireAvailability: true,
      });
      await logActivity(tx, {
        userId: null,
        action: "booking.requested",
        entityType: "Booking",
        entityId: created.booking.id,
        details: {
          bookingNumber: created.booking.bookingNumber,
          roomType: roomType.name,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          totalPriceNpr: created.quote.totalPriceNpr,
          source: "WEBSITE",
        },
      });
      return created;
    }, BOOKING_TX_OPTIONS);

    // The booking is saved; email trouble must never undo it or hide the number.
    let guestEmail: "sent" | "failed" = "failed";
    try {
      const outcome = await notifyBooking("received", booking.id);
      guestEmail = outcome.guest === "sent" ? "sent" : "failed";
    } catch {
      // logged inside notifyBooking where possible
    }
    return { ok: true, bookingNumber: booking.bookingNumber, confirmationEmail: guestEmail };
  } catch (error) {
    if (error instanceof ActionError) return fail(error.message, error.fieldErrors);
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    console.error("Booking request failed:", error instanceof Error ? error.name : "unknown error", code);
    return fail("Something went wrong and your request was not saved. Please try again, or contact us directly.");
  }
}
