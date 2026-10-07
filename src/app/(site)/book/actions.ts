"use server";

import { headers } from "next/headers";
import { db, BOOKING_TX_OPTIONS } from "@/lib/db";
import { logActivity } from "@/lib/activity-log";
import { ActionError } from "@/lib/actions";
import { todayInResort } from "@/lib/dates";
import { createReservationRecord } from "@/lib/booking/service";
import { validateSplit } from "@/lib/booking/multi-room";
import { validateStay } from "@/lib/booking/rules";
import { publicBookingSchema } from "@/lib/booking/schemas";
import { notifyReservation } from "@/lib/email/booking-emails";
import { clientIpFromHeaders, hitRateLimit, rateLimitMessage } from "@/lib/rate-limit";
import { turnstileErrorMessage, verifyTurnstile } from "@/lib/turnstile";

export type BookingRequestState =
  | null
  | {
      ok: true;
      reference: string;
      checkIn: string;
      checkOut: string;
      /** Every room in the request, as saved (prices are the ones computed from the database). */
      rooms: { roomTypeName: string; adults: number; children: number; totalPriceNpr: number }[];
      totalPriceNpr: number;
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

/** Public endpoint: creates a PENDING reservation request for one or more rooms. No sign-in; protected by Turnstile and rate limit. */
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

    // Room types come from the database; the browser only names them. Anything unknown or inactive is refused.
    const typeIds = [...new Set(input.rooms.map((r) => r.roomTypeId))];
    const found = await db.roomType.findMany({ where: { id: { in: typeIds }, isActive: true } });
    if (found.length !== typeIds.length) return fail("One of those room types isn't available any more. Please start again.");
    const roomTypes = new Map(found.map((t) => [t.id, t]));

    const stay = validateStay(input, { today: todayInResort(), publicRequest: true });
    if (!stay.ok) return fail(Object.values(stay.errors)[0], stay.errors);

    const split = validateSplit(input.rooms, roomTypes, { adults: input.adults, children: input.children });
    if (!split.ok) {
      const message = Object.values(split.lineErrors)[0] ?? split.errors[0];
      return fail(message, { rooms: message });
    }

    const ip = clientIpFromHeaders(await headers());
    const limit = await hitRateLimit("booking", ip);
    if (!limit.allowed) return fail(rateLimitMessage(limit.retryAfterSeconds));

    const human = await verifyTurnstile(input.turnstileToken, { ip, expectedAction: "booking" });
    if (!human.ok) return fail(turnstileErrorMessage(human.reason));

    const { reservation, bookings, quote } = await db.$transaction(async (tx) => {
      const created = await createReservationRecord(tx, {
        roomTypes,
        lines: input.rooms,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        guest: { name: input.name, email: input.email, phone: input.phone, country: input.country },
        source: "WEBSITE",
        specialRequests: input.specialRequests,
        requireAvailability: true,
      });
      await logActivity(tx, {
        userId: null,
        action: "reservation.requested",
        entityType: "Reservation",
        entityId: created.reservation.id,
        details: {
          reference: created.reservation.reference,
          rooms: created.bookings.map((b) => roomTypes.get(b.roomTypeId)!.name),
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          totalPriceNpr: created.quote.totalPriceNpr,
          source: "WEBSITE",
        },
      });
      return created;
    }, BOOKING_TX_OPTIONS);

    // The reservation is saved; email trouble must never undo it or hide the reference.
    let guestEmail: "sent" | "failed" = "failed";
    try {
      const outcome = await notifyReservation("received", reservation.id);
      guestEmail = outcome.guest === "sent" ? "sent" : "failed";
    } catch {
      // logged inside notifyReservation where possible
    }
    return {
      ok: true,
      reference: reservation.reference,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      rooms: bookings.map((b) => ({
        roomTypeName: roomTypes.get(b.roomTypeId)!.name,
        adults: b.adults,
        children: b.children,
        totalPriceNpr: b.totalPriceNpr,
      })),
      totalPriceNpr: quote.totalPriceNpr,
      confirmationEmail: guestEmail,
    };
  } catch (error) {
    if (error instanceof ActionError) return fail(error.message, error.fieldErrors);
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    console.error("Booking request failed:", error instanceof Error ? error.name : "unknown error", code);
    return fail("Something went wrong and your request was not saved. Please try again, or contact us directly.");
  }
}
