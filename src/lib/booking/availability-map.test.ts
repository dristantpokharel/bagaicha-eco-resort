import { describe, expect, it } from "vitest";
import {
  buildAvailabilityPayload,
  buildIndex,
  latestCheckOut,
  nextAvailableRanges,
  soldOutForSelection,
  soldOutNights,
  suggestAlternatives,
  typeIsBookable,
  type Occupancy,
  type RoomTypeInfo,
} from "./availability-map";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const stay = (roomId: string, a: string, b: string): Occupancy => ({ roomId, start: d(a), end: d(b) });

const type = (id: string, maxGuests: number, price: number): RoomTypeInfo => ({
  id,
  slug: id,
  name: id.toUpperCase(),
  maxGuests,
  basePriceNpr: price,
  childPricePerNightNpr: 500,
});
const standard = type("std", 2, 5000);
const family = type("fam", 4, 9000);
const types = [standard, family];

describe("soldOutNights", () => {
  const rooms = [
    { id: "s1", roomTypeId: "std" },
    { id: "s2", roomTypeId: "std" },
  ];

  it("is sold out only when every room of the type is occupied that night", () => {
    const index = buildIndex(rooms, [stay("s1", "2026-10-10", "2026-10-14"), stay("s2", "2026-10-12", "2026-10-13")]);
    expect(soldOutNights(index, "std", d("2026-10-09"), 7)).toEqual(["2026-10-12"]);
  });

  it("counts blocks as occupancy and leaves free nights alone (PENDING is never loaded)", () => {
    const index = buildIndex(rooms, [stay("s1", "2026-10-10", "2026-10-12"), stay("s2", "2026-10-11", "2026-10-15")]);
    expect(soldOutNights(index, "std", d("2026-10-10"), 6)).toEqual(["2026-10-11"]);
  });

  it("treats a type with no active rooms as sold out every night", () => {
    const index = buildIndex([], []);
    expect(soldOutNights(index, "std", d("2026-10-10"), 2)).toEqual(["2026-10-10", "2026-10-11"]);
  });

  it("frees the check-out day: a stay ending on the 14th does not occupy the night of the 14th", () => {
    const index = buildIndex([rooms[0]], [stay("s1", "2026-10-10", "2026-10-14")]);
    expect(soldOutNights(index, "std", d("2026-10-13"), 3)).toEqual(["2026-10-13"]);
  });
});

describe("continuity rule", () => {
  const rooms = [
    { id: "a", roomTypeId: "std" },
    { id: "b", roomTypeId: "std" },
  ];
  // Room a is free on the 10th and 11th, room b is free on the 12th: every night has a free room.
  const busy = [stay("a", "2026-10-12", "2026-10-13"), stay("b", "2026-10-10", "2026-10-12")];
  const index = buildIndex(rooms, busy);

  it("no night is sold out...", () => {
    expect(soldOutNights(index, "std", d("2026-10-10"), 3)).toEqual([]);
  });
  it("...but the type is unavailable for the 3-night range because no single room covers it", () => {
    expect(typeIsBookable(index, "std", d("2026-10-10"), d("2026-10-13"))).toBe(false);
  });
  it("is available when one room covers the range", () => {
    expect(typeIsBookable(index, "std", d("2026-10-10"), d("2026-10-12"))).toBe(true);
    expect(typeIsBookable(index, "std", d("2026-10-12"), d("2026-10-13"))).toBe(true);
  });
});

describe("check-out on a sold-out night", () => {
  const soldOut = new Set(["2026-10-14"]);
  const horizon = d("2027-10-06");

  it("allows the check-out to land on the sold-out night", () => {
    expect(latestCheckOut(soldOut, d("2026-10-11"), 30, horizon)).toEqual(d("2026-10-14"));
  });
  it("never lets the range span it", () => {
    expect(latestCheckOut(soldOut, d("2026-10-11"), 30, horizon) < d("2026-10-15")).toBe(true);
  });
  it("is limited by the night cap and the horizon when nothing is sold out", () => {
    expect(latestCheckOut(new Set(), d("2026-10-11"), 30, horizon)).toEqual(d("2026-11-10"));
    expect(latestCheckOut(new Set(), d("2027-10-01"), 30, horizon)).toEqual(horizon);
  });
  it("a room with a stay beginning on the check-out day really is bookable up to it", () => {
    const index = buildIndex([{ id: "a", roomTypeId: "std" }], [stay("a", "2026-10-14", "2026-10-16")]);
    expect(typeIsBookable(index, "std", d("2026-10-11"), d("2026-10-14"))).toBe(true);
    expect(typeIsBookable(index, "std", d("2026-10-11"), d("2026-10-15"))).toBe(false);
  });
});

describe("soldOutForSelection", () => {
  const rooms = [
    { id: "s1", roomTypeId: "std" },
    { id: "f1", roomTypeId: "fam" },
  ];
  const index = buildIndex(rooms, [stay("s1", "2026-10-10", "2026-10-12"), stay("f1", "2026-10-11", "2026-10-13")]);
  const payload = buildAvailabilityPayload(types, index, d("2026-10-10"), 4);

  it("exposes only sold-out nights per type", () => {
    expect(payload.types.map((t) => Object.keys(t).sort())).toEqual([
      ["maxGuests", "name", "slug", "soldOut"],
      ["maxGuests", "name", "slug", "soldOut"],
    ]);
  });
  it("a chosen type uses its own sold-out nights", () => {
    expect([...soldOutForSelection(payload, "std", 2)]).toEqual(["2026-10-10", "2026-10-11"]);
  });
  it("any room, party of 2: sold out only when every type is", () => {
    expect([...soldOutForSelection(payload, null, 2)]).toEqual(["2026-10-11"]);
  });
  it("any room, party of 4: only types that sleep the party count", () => {
    expect([...soldOutForSelection(payload, null, 4)].sort()).toEqual(["2026-10-11", "2026-10-12"]);
  });
});

describe("alternatives", () => {
  const today = d("2026-10-06");
  const base = { types, today, withinDays: 60, maxRanges: 3, maxDaysAhead: 365 };
  const rooms = [
    { id: "s1", roomTypeId: "std" },
    { id: "f1", roomTypeId: "fam" },
  ];

  it("offers other fitting types for the same dates with totals, excluding the chosen one", () => {
    const index = buildIndex(rooms, [stay("s1", "2026-10-10", "2026-10-20")]);
    const { otherTypes } = suggestAlternatives({
      ...base, index, chosenTypeId: "std", checkIn: d("2026-10-12"), checkOut: d("2026-10-15"), adults: 2, children: 1,
    });
    expect(otherTypes.map((o) => o.roomType.id)).toEqual(["fam"]);
    expect(otherTypes[0].quote.totalPriceNpr).toBe(3 * 9000 + 3 * 1 * 500);
  });

  it("skips types that can't sleep the party or have no single free room", () => {
    const index = buildIndex(rooms, [stay("s1", "2026-10-10", "2026-10-20"), stay("f1", "2026-10-14", "2026-10-15")]);
    const { otherTypes } = suggestAlternatives({
      ...base, index, chosenTypeId: "std", checkIn: d("2026-10-12"), checkOut: d("2026-10-16"), adults: 2, children: 0,
    });
    expect(otherTypes).toEqual([]);
    const big = suggestAlternatives({
      ...base, index: buildIndex(rooms, [stay("s1", "2026-10-10", "2026-10-20")]), chosenTypeId: "fam",
      checkIn: d("2026-10-12"), checkOut: d("2026-10-15"), adults: 3, children: 1,
    });
    expect(big.otherTypes).toEqual([]); // std sleeps 2
  });

  it("suggests the next same-length ranges for the chosen type, distinct and capped", () => {
    const index = buildIndex(rooms, [stay("s1", "2026-10-10", "2026-10-20")]);
    const { dateRanges } = suggestAlternatives({
      ...base, index, chosenTypeId: "std", checkIn: d("2026-10-12"), checkOut: d("2026-10-15"), adults: 2, children: 0,
    });
    expect(dateRanges).toEqual([
      { checkIn: d("2026-10-20"), checkOut: d("2026-10-23") },
      { checkIn: d("2026-10-23"), checkOut: d("2026-10-26") },
      { checkIn: d("2026-10-26"), checkOut: d("2026-10-29") },
    ]);
  });

  it("only suggests ranges within the window", () => {
    const index = buildIndex(rooms, [stay("s1", "2026-10-10", "2027-03-01")]);
    const found = nextAvailableRanges(index, ["std"], {
      after: d("2026-10-12"), nights: 3, withinDays: 60, max: 3, horizon: d("2027-10-06"),
    });
    expect(found).toEqual([]);
  });

  it("returns nothing when no type or range fits, so the page falls back to /enquiry", () => {
    const index = buildIndex(rooms, [stay("s1", "2026-10-01", "2027-03-01"), stay("f1", "2026-10-01", "2027-03-01")]);
    const out = suggestAlternatives({
      ...base, index, chosenTypeId: "std", checkIn: d("2026-10-12"), checkOut: d("2026-10-15"), adults: 2, children: 0,
    });
    expect(out).toEqual({ otherTypes: [], dateRanges: [] });
  });

  it("with no chosen type, date suggestions use any fitting type", () => {
    const index = buildIndex(rooms, [stay("s1", "2026-10-10", "2026-10-30"), stay("f1", "2026-10-10", "2026-10-25")]);
    const { dateRanges } = suggestAlternatives({
      ...base, index, chosenTypeId: null, checkIn: d("2026-10-12"), checkOut: d("2026-10-14"), adults: 2, children: 0,
    });
    expect(dateRanges[0]).toEqual({ checkIn: d("2026-10-25"), checkOut: d("2026-10-27") });
  });
});
