/**
 * Booking rules and limits. Check-in/out times live in BusinessInfo and the cancellation
 * policy in Policies (see src/lib/content/stay-terms.ts), so staff can edit them in admin.
 * Prices and room capacity live in the database (RoomType), not here. So does the child age limit
 * (BusinessInfo.childUnderAge, read through StayTerms): never hardcode it.
 */
export const BOOKING = {
  /** Public requests only; staff can book outside these limits. */
  maxNights: 30,
  maxDaysAhead: 365,
  /** Prefilled on phone fields; numbers are stored in international form. */
  defaultCountryCode: "+977",
} as const;
