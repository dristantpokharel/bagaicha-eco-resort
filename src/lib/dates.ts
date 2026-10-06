import { formatInTimeZone } from "date-fns-tz";

/** The resort's timezone. "Today" and displayed times use it. */
export const RESORT_TIMEZONE = "Asia/Kathmandu";

export function formatDateTime(date: Date) {
  return formatInTimeZone(date, RESORT_TIMEZONE, "d MMM yyyy, HH:mm");
}
