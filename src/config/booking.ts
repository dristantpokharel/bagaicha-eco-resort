/**
 * Booking rules and limits. Check-in/out times live in BusinessInfo and the cancellation
 * policy in Policies (see src/lib/content/stay-terms.ts), so staff can edit them in admin.
 * Prices and room capacity live in the database (RoomType), not here.
 */
export const BOOKING = {
  /** Children below this age pay the per-child rate; from this age they count as adults. */
  childUnderAge: 8,
  /** Public requests only; staff can book outside these limits. */
  maxNights: 30,
  maxDaysAhead: 365,
  /** Prefilled on phone fields; numbers are stored in international form. */
  defaultCountryCode: "+977",
} as const;
