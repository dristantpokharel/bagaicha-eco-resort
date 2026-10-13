import { describe, expect, it } from "vitest";
import { parseDateOnly } from "./dates";
import { barColumns, parseMonth, parseTapeRange } from "./calendar";

const d = (s: string) => parseDateOnly(s)!;
const today = d("2026-10-06");

describe("parseMonth", () => {
  it("parses a month with its length and neighbours", () => {
    const m = parseMonth("2028-02", today);
    expect(m).toMatchObject({ key: "2028-02", days: 29, prev: "2028-01", next: "2028-03" });
    expect(parseMonth("2026-12", today).next).toBe("2027-01");
    expect(parseMonth("2026-01", today).prev).toBe("2025-12");
  });
  it("falls back to the current month on bad input", () => {
    for (const bad of [undefined, "", "2026-13", "garbage", "1999-01"]) expect(parseMonth(bad, today).key).toBe("2026-10");
  });
});

describe("barColumns", () => {
  const oct = parseMonth("2026-10", today);
  it("gives one column per night", () => {
    expect(barColumns(d("2026-10-10"), d("2026-10-12"), oct)).toEqual({ start: 10, end: 12 });
    expect(barColumns(d("2026-10-10"), d("2026-10-11"), oct)).toEqual({ start: 10, end: 11 });
  });
  it("clips stays that cross month edges", () => {
    expect(barColumns(d("2026-09-28"), d("2026-10-03"), oct)).toEqual({ start: 1, end: 3 });
    expect(barColumns(d("2026-10-30"), d("2026-11-04"), oct)).toEqual({ start: 30, end: 32 });
  });
  it("ignores stays outside the month, including one ending on the 1st", () => {
    expect(barColumns(d("2026-09-28"), d("2026-10-01"), oct)).toBeNull();
    expect(barColumns(d("2026-11-01"), d("2026-11-03"), oct)).toBeNull();
  });
});

describe("parseTapeRange", () => {
  it("defaults to a fortnight starting today", () => {
    const r = parseTapeRange({}, today);
    expect(r).toMatchObject({ view: "2w", days: 14, prev: "view=2w&from=2026-09-22", next: "view=2w&from=2026-10-20", here: "view=2w&from=2026-10-06" });
    expect(r.start).toEqual(today);
    expect(r.end).toEqual(d("2026-10-20"));
  });
  it("starts a fortnight on the requested day, ignoring bad dates", () => {
    expect(parseTapeRange({ view: "2w", from: "2026-11-01" }, today).start).toEqual(d("2026-11-01"));
    expect(parseTapeRange({ from: "2026-13-45" }, today).start).toEqual(today);
  });
  it("keeps old ?month= links working as the month view", () => {
    const r = parseTapeRange({ month: "2026-12" }, today);
    expect(r).toMatchObject({ view: "month", days: 31, prev: "view=month&month=2026-11", next: "view=month&month=2027-01" });
    expect(r.start).toEqual(d("2026-12-01"));
  });
  it("falls back to this month for a bad month, and links to the same period in the other view", () => {
    expect(parseTapeRange({ month: "nonsense" }, today).start).toEqual(d("2026-10-01"));
    expect(parseTapeRange({ view: "month" }, today).other).toBe("view=2w&from=2026-10-06");
    expect(parseTapeRange({ month: "2026-12" }, today).other).toBe("view=2w&from=2026-12-01");
    expect(parseTapeRange({ view: "2w", from: "2026-11-09" }, today).other).toBe("view=month&month=2026-11");
  });
});
