import { describe, expect, it } from "vitest";
import { activityWhere, parseActivityFilters, SYSTEM_USER } from "./filters";

describe("parseActivityFilters", () => {
  it("reads valid values and defaults the rest", () => {
    expect(parseActivityFilters({})).toEqual({ user: "", action: "", from: "", to: "", page: 1 });
    expect(parseActivityFilters({ user: "u1", action: "stock.used", from: "2026-10-01", to: "2026-10-06", page: "3" })).toEqual({
      user: "u1",
      action: "stock.used",
      from: "2026-10-01",
      to: "2026-10-06",
      page: 3,
    });
  });
  it("drops bad dates and pages, and takes the first of repeated params", () => {
    const f = parseActivityFilters({ from: "yesterday", to: "2026-02-31", page: ["0", "2"] });
    expect(f).toMatchObject({ from: "", to: "", page: 1 });
    expect(parseActivityFilters({ user: ["a", "b"] }).user).toBe("a");
  });
});

describe("activityWhere", () => {
  const base = { user: "", action: "", from: "", to: "", page: 1 };
  it("is empty without filters", () => {
    expect(activityWhere(base)).toEqual({});
  });
  it("filters by user, system and action", () => {
    expect(activityWhere({ ...base, user: "u1", action: "stock.used" })).toEqual({ userId: "u1", action: "stock.used" });
    expect(activityWhere({ ...base, user: SYSTEM_USER })).toEqual({ userId: null });
  });
  it("uses Kathmandu (UTC+5:45) day boundaries, with the end day included", () => {
    const where = activityWhere({ ...base, from: "2026-10-06", to: "2026-10-06" });
    const created = where.createdAt as { gte: Date; lt: Date };
    expect(created.gte.toISOString()).toBe("2026-10-05T18:15:00.000Z");
    expect(created.lt.toISOString()).toBe("2026-10-06T18:15:00.000Z");
  });
});
