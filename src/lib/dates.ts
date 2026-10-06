import { formatInTimeZone } from "date-fns-tz";

/** The resort's timezone. "Today" and displayed times use it. */
export const RESORT_TIMEZONE = "Asia/Kathmandu";

export function formatDateTime(date: Date) {
  return formatInTimeZone(date, RESORT_TIMEZONE, "d MMM yyyy, HH:mm");
}

/**
 * Today's date in the resort's timezone, as UTC midnight: the form Prisma uses
 * for @db.Date columns, so it compares correctly with checkIn/checkOut.
 */
export function todayInResort(now = new Date()): Date {
  return new Date(`${formatInTimeZone(now, RESORT_TIMEZONE, "yyyy-MM-dd")}T00:00:00.000Z`);
}
