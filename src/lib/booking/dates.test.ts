import { describe, expect, it } from "vitest";
import { addDays, describeRange, nightsBetween, parseDateOnly, rangesOverlap, toDateOnlyString } from "./dates";

const d = (s: string) => parseDateOnly(s)!;

describe("parseDateOnly", () => {
  it("parses real dates at UTC midnight", () => {
    expect(d("2026-10-12").toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });
  it("rejects malformed and impossible dates", () => {
    for (const bad of ["", "2026-13-01", "2026-02-30", "12/10/2026", "2026-1-1", "2026-10-12T00:00"]) {
      expect(parseDateOnly(bad)).toBeNull();
    }
  });
  it("accepts a leap day only in leap years", () => {
    expect(parseDateOnly("2028-02-29")).not.toBeNull();
    expect(parseDateOnly("2027-02-29")).toBeNull();
  });
});

describe("date arithmetic", () => {
  it("counts nights and adds days across month ends", () => {
    expect(nightsBetween(d("2026-10-30"), d("2026-11-02"))).toBe(3);
    expect(toDateOnlyString(addDays(d("2026-10-30"), 3))).toBe("2026-11-02");
  });
});

// Ported from the legacy site's assertions: an existing stay on the night of 24 Feb.
describe("rangesOverlap [start, end)", () => {
  const existing = [d("2026-02-24"), d("2026-02-25")] as const;
  const overlaps = (a: string, b: string) => rangesOverlap(...existing, d(a), d(b));

  it("allows a stay that ends the day the existing one starts", () => {
    expect(overlaps("2026-02-23", "2026-02-24")).toBe(false);
  });
  it("allows a stay that starts the day the existing one ends", () => {
    expect(overlaps("2026-02-25", "2026-02-26")).toBe(false);
  });
  it("rejects the same night and enclosing ranges", () => {
    expect(overlaps("2026-02-24", "2026-02-25")).toBe(true);
    expect(overlaps("2026-02-23", "2026-02-26")).toBe(true);
  });
  it("rejects partial overlaps on either side", () => {
    expect(overlaps("2026-02-23", "2026-02-25")).toBe(true);
    expect(overlaps("2026-02-24", "2026-02-26")).toBe(true);
  });
});

describe("describeRange", () => {
  it("reads like the calendar footer", () => {
    expect(describeRange(d("2026-10-09"), d("2026-10-16"))).toBe("9 Oct → 16 Oct · 7 nights");
    expect(describeRange(d("2026-10-09"), d("2026-10-10"))).toBe("9 Oct → 10 Oct · 1 night");
  });
  it("adds years when the stay crosses New Year", () => {
    expect(describeRange(d("2026-12-30"), d("2027-01-02"))).toBe("30 Dec 2026 → 2 Jan 2027 · 3 nights");
  });
});
