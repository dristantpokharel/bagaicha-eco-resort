import { SITE } from "@/config/site";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity-log";
import { nightsBetween } from "@/lib/booking/dates";
import { computeQuote } from "@/lib/booking/pricing";
import { ENQUIRY_TYPE_LABELS } from "@/lib/booking/labels";
import { sendEmail, type EmailMessage, type SendResult } from "./send";
import {
  bookingCancelledEmail,
  bookingConfirmedEmail,
  newEnquiryAlertEmail,
  newRequestAlertEmail,
  requestReceivedEmail,
  type BookingEmailData,
  type RenderedEmail,
} from "./templates";

export type BookingEmailKind = "received" | "confirmed" | "cancelled";

/** What happened, for the caller to report. Emails never roll back the booking. */
export type NotifyOutcome = {
  /** The guest's email: "skipped" when they have no email address. */
  guest: "sent" | "failed" | "skipped";
  /** The alert to the resort team ("n/a" for kinds that don't send one). */
  resort: "sent" | "failed" | "n/a";
};

export async function loadBookingEmailData(bookingId: string): Promise<BookingEmailData | null> {
  const b = await db.booking.findUnique({
    where: { id: bookingId },
    include: { guest: true, roomType: { select: { name: true } }, room: { select: { name: true } } },
  });
  if (!b) return null;
  return {
    id: b.id,
    bookingNumber: b.bookingNumber,
    guestName: b.guest.name,
    guestEmail: b.guest.email,
    guestPhone: b.guest.phone,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    adults: b.adults,
    children: b.children,
    roomTypeName: b.roomType.name,
    roomName: b.room?.name ?? null,
    quote: computeQuote({
      nights: nightsBetween(b.checkIn, b.checkOut),
      pricePerNightNpr: b.pricePerNightNpr,
      childPricePerNightNpr: b.childPricePerNightNpr,
      children: b.children,
    }),
    specialRequests: b.specialRequests,
    cancellationReason: b.cancellationReason,
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
 * Sends the emails for a booking event, after the change is committed.
 * received → guest receipt + resort alert; confirmed / cancelled → guest only.
 */
export async function notifyBooking(kind: BookingEmailKind, bookingId: string): Promise<NotifyOutcome> {
  const data = await loadBookingEmailData(bookingId);
  if (!data) return { guest: "failed", resort: kind === "received" ? "failed" : "n/a" };

  let guest: NotifyOutcome["guest"] = "skipped";
  if (data.guestEmail) {
    const render = { received: requestReceivedEmail, confirmed: bookingConfirmedEmail, cancelled: bookingCancelledEmail }[kind];
    guest = (await deliver(data.guestEmail, render(data), "Booking", bookingId, `guest.${kind}`)) ? "sent" : "failed";
  }

  let resort: NotifyOutcome["resort"] = "n/a";
  if (kind === "received") {
    const alertTo = process.env.BOOKING_ALERT_TO?.trim();
    if (alertTo) {
      const ok = await deliver(
        alertTo,
        newRequestAlertEmail(data, adminUrl(`/admin/bookings/${bookingId}`)),
        "Booking",
        bookingId,
        "resort.newRequest",
      );
      resort = ok ? "sent" : "failed";
    } else {
      await logFailure("Booking", bookingId, "resort.newRequest", { ok: false, reason: "not-configured" });
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
