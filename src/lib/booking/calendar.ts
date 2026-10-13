import { addDays, nightsBetween, parseDateOnly, toDateOnlyString } from "./dates";
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
export function barColumns(checkIn: Date, checkOut: Date, month: { start: Date; end: Date }): { start: number; end: number } | null {
  const from = checkIn > month.start ? checkIn : month.start;
  const to = checkOut < month.end ? checkOut : month.end;
  if (to <= from) return null;
  return { start: nightsBetween(month.start, from) + 1, end: nightsBetween(month.start, to) + 1 };
}

export function monthDays(month: { start: Date; days: number }): Date[] {
  return Array.from({ length: month.days }, (_, i) => addDays(month.start, i));
}

export type TapeView = "2w" | "month";

/** The days a tape chart shows, plus the query strings for its navigation links. */
export type TapeRange = {
  view: TapeView;
  start: Date;
  /** Exclusive. */
  end: Date;
  days: number;
  prev: string;
  next: string;
  /** Same period in the other view. */
  other: string;
  /** Query string for "today" in this view. */
  here: string;
};

const FORTNIGHT = 14;
const dateQuery = (d: Date) => `view=2w&from=${toDateOnlyString(d)}`;

/**
 * Reads the chart's URL: `?month=YYYY-MM` (also the old calendar links) is the month view; `?view=2w&from=date`
 * (or no query) is a fortnight starting that day, today by default. Anything invalid falls back to today.
 */
export function parseTapeRange(sp: { view?: string; from?: string; month?: string }, today: Date = todayInResort()): TapeRange {
  const wantsMonth = sp.view === "month" || (sp.month !== undefined && sp.view !== "2w");
  if (wantsMonth) {
    const month = parseMonth(sp.month ?? (sp.from ? sp.from.slice(0, 7) : undefined), today);
    const here = "view=month";
    return {
      view: "month",
      start: month.start,
      end: month.end,
      days: month.days,
      prev: `view=month&month=${month.prev}`,
      next: `view=month&month=${month.next}`,
      other: dateQuery(month.start <= today && today < month.end ? today : month.start),
      here,
    };
  }
  const from = sp.from ? parseDateOnly(sp.from) : null;
  const start = from ?? today;
  return {
    view: "2w",
    start,
    end: addDays(start, FORTNIGHT),
    days: FORTNIGHT,
    prev: dateQuery(addDays(start, -FORTNIGHT)),
    next: dateQuery(addDays(start, FORTNIGHT)),
    other: `view=month&month=${keyOf(start)}`,
    here: dateQuery(today),
  };
}
