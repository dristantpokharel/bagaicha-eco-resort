import { addDays, nightsBetween, toDateOnlyString } from "./dates";
import { todayInResort } from "@/lib/dates";

export type MonthRange = {
  /** "2026-10" */
  key: string;
  start: Date;
  /** First day of the next month (exclusive). */
  end: Date;
  days: number;
  prev: string;
  next: string;
};

const MONTH = /^(\d{4})-(\d{2})$/;

const keyOf = (date: Date) => toDateOnlyString(date).slice(0, 7);

/** Parses "YYYY-MM"; anything invalid falls back to the current month in Asia/Kathmandu. */
export function parseMonth(value: string | undefined, today: Date = todayInResort()): MonthRange {
  const match = value ? MONTH.exec(value) : null;
  let year = today.getUTCFullYear();
  let month = today.getUTCMonth();
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    if (m >= 1 && m <= 12 && y >= 2000 && y <= 2100) {
      year = y;
      month = m - 1;
    }
  }
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return {
    key: keyOf(start),
    start,
    end,
    days: nightsBetween(start, end),
    prev: keyOf(new Date(Date.UTC(year, month - 1, 1))),
    next: keyOf(end),
  };
}

/**
 * Grid columns (1-based, end exclusive) a stay [checkIn, checkOut) covers inside
 * the month, one column per night. Null when it doesn't touch the month.
 */
export function barColumns(checkIn: Date, checkOut: Date, month: MonthRange): { start: number; end: number } | null {
  const from = checkIn > month.start ? checkIn : month.start;
  const to = checkOut < month.end ? checkOut : month.end;
  if (to <= from) return null;
  return { start: nightsBetween(month.start, from) + 1, end: nightsBetween(month.start, to) + 1 };
}

export function monthDays(month: MonthRange): Date[] {
  return Array.from({ length: month.days }, (_, i) => addDays(month.start, i));
}
