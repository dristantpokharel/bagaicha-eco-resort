/**
 * Booking policy: the one place for stay times, limits and policy text.
 * Prices and room capacity live in the database (RoomType), not here.
 */
export const BOOKING = {
  /** Shown to guests as-is (emails, /book). */
  checkInTime: "2:00 PM",
  checkOutTime: "11:00 AM",
  /** Children below this age pay the per-child rate; from this age they count as adults. */
  childUnderAge: 8,
  /** Public requests only; staff can book outside these limits. */
  maxNights: 30,
  maxDaysAhead: 365,
  /** Prefilled on phone fields; numbers are stored in international form. */
  defaultCountryCode: "+977",
  cancellationPolicy: {
    /** DEV PLACEHOLDER: the owner hasn't decided the policy. Must be replaced before launch (Phase 6). */
    isPlaceholder: true,
    text: "DEV PLACEHOLDER: the cancellation policy has not been decided yet. Please contact the resort to cancel or change your booking.",
  },
} as const;
