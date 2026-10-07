import { SITE } from "@/config/site";
import { db } from "@/lib/db";
import { loadStayTerms } from "@/lib/content/stay-terms";
import { logActivity } from "@/lib/activity-log";
import { nightsBetween } from "@/lib/booking/dates";
import { computeQuote } from "@/lib/booking/pricing";
import { ENQUIRY_TYPE_LABELS } from "@/lib/booking/labels";
import { sendEmail, type EmailMessage, type SendResult } from "./send";
import {
  bookingCancelledEmail,
  bookingConfirmedEmail,
  bookingPartiallyConfirmedEmail,
  newEnquiryAlertEmail,
  newRequestAlertEmail,
  requestReceivedEmail,
  type RenderedEmail,
  type ReservationEmailData,
} from "./templates";

export type ReservationEmailKind = "received" | "confirmed" | "partial" | "cancelled";

/** What happened, for the caller to report. Emails never roll back the booking. */
export type NotifyOutcome = {
  /** The guest's email: "skipped" when they have no email address. */
  guest: "sent" | "failed" | "skipped";
  /** The alert to the resort team ("n/a" for kinds that don't send one). */
  resort: "sent" | "failed" | "n/a";
};

export async function loadReservationEmailData(reservationId: string): Promise<ReservationEmailData | null> {
  const r = await db.reservation.findUnique({
    where: { id: reservationId },
    include: {
      bookings: {
        include: { roomType: { select: { name: true } }, room: { select: { name: true } } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!r) return null;
  const nights = nightsBetween(r.checkIn, r.checkOut);
  return {
    id: r.id,
    reference: r.reference,
    guestName: r.guestName,
    guestEmail: r.guestEmail,
    guestPhone: r.guestPhone,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    nights,
    specialRequests: r.specialRequests,
    lines: r.bookings.map((b) => ({
      roomTypeName: b.roomType.name,
      roomName: b.room?.name ?? null,
      adults: b.adults,
      children: b.children,
      status: b.status,
      cancellationReason: b.cancellationReason,
      quote: computeQuote({
        nights,
        pricePerNightNpr: b.pricePerNightNpr,
        childPricePerNightNpr: b.childPricePerNightNpr,
        children: b.children,
      }),
    })),
    terms: await loadStayTerms(),
  };
}

function adminUrl(path: string) {
  return new URL(path, SITE.url).toString();
}

async function logFailure(entityType: string, entityId: string, template: string, result: Extract<SendResult, { ok: false }>) {
  await db
    .$transaction((tx) =>
      logActivity(tx, {
        userId: null,
        action: "email.failed",
        entityType,
        entityId,
        details: { template, reason: result.reason, ...(result.status ? { status: result.status } : {}) },
      }),
    )
    .catch(() => undefined);
}

async function deliver(
  to: string,
  email: RenderedEmail,
  entityType: string,
  entityId: string,
  template: string,
): Promise<boolean> {
  const message: EmailMessage = { to, ...email };
  const result = await sendEmail(message);
  if (!result.ok) await logFailure(entityType, entityId, template, result);
  return result.ok;
}

/**
 * Sends the emails for a reservation event, after the change is committed.
 * received → guest receipt + resort alert; confirmed / partial / cancelled → guest only.
 */
export async function notifyReservation(kind: ReservationEmailKind, reservationId: string): Promise<NotifyOutcome> {
  const data = await loadReservationEmailData(reservationId);
  if (!data) return { guest: "failed", resort: kind === "received" ? "failed" : "n/a" };

  let guest: NotifyOutcome["guest"] = "skipped";
  if (data.guestEmail) {
    const render = {
      received: requestReceivedEmail,
      confirmed: bookingConfirmedEmail,
      partial: bookingPartiallyConfirmedEmail,
      cancelled: bookingCancelledEmail,
    }[kind];
    guest = (await deliver(data.guestEmail, render(data), "Reservation", reservationId, `guest.${kind}`)) ? "sent" : "failed";
  }

  let resort: NotifyOutcome["resort"] = "n/a";
  if (kind === "received") {
    const alertTo = process.env.BOOKING_ALERT_TO?.trim();
    if (alertTo) {
      const ok = await deliver(
        alertTo,
        newRequestAlertEmail(data, adminUrl(`/admin/bookings/${reservationId}`)),
        "Reservation",
        reservationId,
        "resort.newRequest",
      );
      resort = ok ? "sent" : "failed";
    } else {
      await logFailure("Reservation", reservationId, "resort.newRequest", { ok: false, reason: "not-configured" });
      resort = "failed";
    }
  }
  return { guest, resort };
}

export async function notifyNewEnquiry(enquiryId: string): Promise<boolean> {
  const e = await db.enquiry.findUnique({ where: { id: enquiryId } });
  if (!e) return false;
  const alertTo = process.env.BOOKING_ALERT_TO?.trim();
  if (!alertTo) {
    await logFailure("Enquiry", enquiryId, "resort.newEnquiry", { ok: false, reason: "not-configured" });
    return false;
  }
  return deliver(
    alertTo,
    newEnquiryAlertEmail(
      { name: e.name, email: e.email, phone: e.phone, typeLabel: ENQUIRY_TYPE_LABELS[e.type], message: e.message },
      adminUrl("/admin/enquiries"),
    ),
    "Enquiry",
    enquiryId,
    "resort.newEnquiry",
  );
}
