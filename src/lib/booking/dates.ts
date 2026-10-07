import { formatInTimeZone } from "date-fns-tz";

/**
 * Stay dates are date-only. In code they are UTC-midnight Dates (what Prisma
 * returns for @db.Date), never local time, so results don't depend on the
 * server's timezone. A stay occupies nights [checkIn, checkOut): the check-out
 * day is free for the next guest.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** "2026-10-12" → Date at UTC midnight; null if malformed or not a real date. */
export function parseDateOnly(value: string): Date | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const valid = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  return valid ? date : null;
}

export function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function nightsBetween(checkIn: Date, checkOut: Date): number {
  return Math.round((checkOut.getTime() - checkIn.getTime()) / DAY_MS);
}

/** True when [aStart, aEnd) and [bStart, bEnd) share at least one night. */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** "Mon, 12 Oct 2026" for a date-only value. */
export function formatStayDate(date: Date): string {
  return formatInTimeZone(date, "UTC", "EEE, d MMM yyyy");
}

/** "12 Oct" for compact tables. */
export function formatShortDate(date: Date): string {
  return formatInTimeZone(date, "UTC", "d MMM");
}

/** "12 Oct 2026" for the date-range field. */
export function formatCompactDate(date: Date): string {
  return formatInTimeZone(date, "UTC", "d MMM yyyy");
}

/** "9 Oct → 16 Oct · 7 nights" (calendar footer). Years appear only when the stay crosses into another year. */
export function describeRange(checkIn: Date, checkOut: Date): string {
  const nights = nightsBetween(checkIn, checkOut);
  const pattern = checkIn.getUTCFullYear() === checkOut.getUTCFullYear() ? "d MMM" : "d MMM yyyy";
  const show = (d: Date) => formatInTimeZone(d, "UTC", pattern);
  return `${show(checkIn)} → ${show(checkOut)} · ${nights} night${nights === 1 ? "" : "s"}`;
}
