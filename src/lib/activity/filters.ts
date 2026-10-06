import { fromZonedTime } from "date-fns-tz";
import type { Prisma } from "@/generated/prisma/client";
import { parseDateOnly, addDays, toDateOnlyString } from "@/lib/booking/dates";
import { RESORT_TIMEZONE } from "@/lib/dates";

export const ACTIVITY_PAGE_SIZE = 50;
/** `user` value for entries with no user (guests' requests, seed, system). */
export const SYSTEM_USER = "system";

export type ActivityFilters = {
  user: string;
  action: string;
  /** yyyy-MM-dd in the resort's timezone, or "". */
  from: string;
  to: string;
  page: number;
};

type Params = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export function parseActivityFilters(params: Params): ActivityFilters {
  const date = (value: string) => (parseDateOnly(value) ? value : "");
  const page = Number(first(params.page));
  return {
    user: first(params.user).trim().slice(0, 64),
    action: first(params.action).trim().slice(0, 80),
    from: date(first(params.from)),
    to: date(first(params.to)),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Start of a resort-timezone day, as a UTC instant. */
function startOfDay(day: string): Date {
  return fromZonedTime(`${day}T00:00:00`, RESORT_TIMEZONE);
}

export function activityWhere(filters: ActivityFilters): Prisma.ActivityLogWhereInput {
  const where: Prisma.ActivityLogWhereInput = {};
  if (filters.user === SYSTEM_USER) where.userId = null;
  else if (filters.user) where.userId = filters.user;
  if (filters.action) where.action = filters.action;

  const created: Prisma.DateTimeFilter = {};
  if (filters.from) created.gte = startOfDay(filters.from);
  if (filters.to) {
    // The "to" day is included: stop at the start of the next day.
    const next = addDays(parseDateOnly(filters.to)!, 1);
    created.lt = startOfDay(toDateOnlyString(next));
  }
  if (created.gte || created.lt) where.createdAt = created;
  return where;
}
