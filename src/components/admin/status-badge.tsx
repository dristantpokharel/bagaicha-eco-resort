import type { BookingStatus } from "@/generated/prisma/enums";
import { BOOKING_STATUS_LABELS, RESERVATION_STATUS_LABELS } from "@/lib/booking/labels";
import type { ReservationStatus } from "@/lib/booking/reservation-status";

const STYLES: Record<BookingStatus, string> = {
  PENDING: "border-warning/40 bg-warning/10 text-warning",
  CONFIRMED: "border-forest/30 bg-forest/10 text-forest",
  CHECKED_IN: "border-success/40 bg-success/10 text-success",
  CHECKED_OUT: "border-charcoal/20 bg-charcoal/5 text-charcoal-light",
  CANCELLED: "border-error/30 bg-error/5 text-error",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STYLES[status]}`}>
      {BOOKING_STATUS_LABELS[status]}
    </span>
  );
}

const RESERVATION_STYLES: Record<ReservationStatus, string> = {
  PENDING: STYLES.PENDING,
  PARTIALLY_CONFIRMED: "border-warning/40 bg-forest/10 text-forest",
  CONFIRMED: STYLES.CONFIRMED,
  COMPLETED: STYLES.CHECKED_OUT,
  CANCELLED: STYLES.CANCELLED,
};

/** The status of a whole reservation (derived from its rooms). */
export function ReservationStatusBadge({ status }: { status: ReservationStatus }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${RESERVATION_STYLES[status]}`}>
      {RESERVATION_STATUS_LABELS[status]}
    </span>
  );
}
