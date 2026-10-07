import { describe, expect, it } from "vitest";
import {
  buildAvailabilityPayload,
  buildIndex,
  freeCountsByNight,
  freeRoomCount,
  latestCheckOut,
  nextAvailableRanges,
  partyCanStay,
  soldOutForSelection,
  soldOutNights,
  suggestAlternatives,
  typeIsBookable,
  unavailableReason,
  type Occupancy,
  type RoomTypeInfo,
} from "./availability-map";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const stay = (roomId: string, a: string, b: string): Occupancy => ({ roomId, start: d(a), end: d(b) });

const type = (id: string, maxGuests: number, price: number, maxAdults = maxGuests, maxChildren: number | null = null): RoomTypeInfo => ({
  id,
  slug: id,
  name: id.toUpperCase(),
  maxGuests,
  maxAdults,
  maxChildren,
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

describe("free rooms for the whole stay", () => {
  const rooms = [
    { id: "a", roomTypeId: "std" },
    { id: "b", roomTypeId: "std" },
    { id: "c", roomTypeId: "std" },
  ];
  it("counts distinct rooms that are free on every night; rooms free on different nights don't add up", () => {
    // a is busy the first night, b the last night, c is free throughout.
    const index = buildIndex(rooms, [stay("a", "2026-10-10", "2026-10-11"), stay("b", "2026-10-12", "2026-10-13")]);
    expect(freeRoomCount(index, "std", d("2026-10-10"), d("2026-10-13"))).toBe(1);
    expect(freeRoomCount(index, "std", d("2026-10-10"), d("2026-10-12"))).toBe(2);
    expect(freeCountsByNight(index, "std", d("2026-10-10"), 3)).toEqual([2, 3, 2]);
  });
});

describe("soldOutForSelection", () => {
  const rooms = [
    { id: "s1", roomTypeId: "std" },
    { id: "s2", roomTypeId: "std" },
    { id: "f1", roomTypeId: "fam" },
  ];
  const index = buildIndex(rooms, [
    stay("s1", "2026-10-10", "2026-10-12"),
    stay("s2", "2026-10-11", "2026-10-13"),
    stay("f1", "2026-10-11", "2026-10-13"),
  ]);
  const payload = buildAvailabilityPayload(types, index, d("2026-10-10"), 4);
  const sold = (slug: string | null, adults: number, children = 0) => [...soldOutForSelection(payload, slug, { adults, children })];

  it("exposes only room counts and free rooms per night, capped", () => {
    expect(payload.types.map((t) => Object.keys(t).sort())).toEqual([
      ["free", "maxAdults", "maxChildren", "maxGuests", "name", "rooms", "slug"],
      ["free", "maxAdults", "maxChildren", "maxGuests", "name", "rooms", "slug"],
    ]);
    expect(payload.types.map((t) => t.free)).toEqual(["1012", "1001"]);
    const many = buildAvailabilityPayload([standard], buildIndex(Array.from({ length: 7 }, (_, i) => ({ id: `r${i}`, roomTypeId: "std" })), []), d("2026-10-10"), 1);
    expect(many.types[0].free).toBe("4"); // 7 free, capped at the 4-room limit
  });
  it("a chosen type, party of 2: sold out when none of its rooms is free", () => {
    expect(sold("std", 2)).toEqual(["2026-10-11"]); // both Standards are busy that night
    expect(sold("fam", 2)).toEqual(["2026-10-11", "2026-10-12"]);
  });
  it("a chosen type, party that needs two of its rooms: sold out when fewer than two are free", () => {
    expect(sold("std", 4)).toEqual(["2026-10-10", "2026-10-11", "2026-10-12"]); // Standard sleeps 2: both rooms must be free
  });
  it("any room, party of 4: one Family, or two Standards, or a mix, may hold it", () => {
    // On the 11th nothing is free; on the 12th only s1 (2 guests) is, which can't hold 4.
    expect(sold(null, 4)).toEqual(["2026-10-11", "2026-10-12"]);
  });
  it("a party no combination could ever hold shades nothing (the page explains it)", () => {
    expect(sold(null, 20)).toEqual([]);
    expect(sold("std", 5)).toEqual([]);
  });
});

describe("alternatives", () => {
  const today = d("2026-10-06");
  const base = { types, today, withinDays: 60, maxRanges: 3, maxDaysAhead: 365 };
  const rooms = [
    { id: "s1", roomTypeId: "std" },
    { id: "f1", roomTypeId: "fam" },
  ];

  it("suggests a combination that holds a party no single room takes, with the total", () => {
    const index = buildIndex(rooms, []);
    const { combination } = suggestAlternatives({
      ...base, index, chosenTypeId: null, checkIn: d("2026-10-12"), checkOut: d("2026-10-14"), adults: 5, children: 1,
    });
    expect(combination?.lines.map((l) => l.roomTypeId).sort()).toEqual(["fam", "std"]);
    expect(combination?.quote.totalPriceNpr).toBe(2 * 5000 + 2 * 9000 + 2 * 1 * 500);
  });

  it("uses only rooms free for the whole stay", () => {
    const index = buildIndex(rooms, [stay("s1", "2026-10-13", "2026-10-14")]);
    const { combination } = suggestAlternatives({
      ...base, index, chosenTypeId: null, checkIn: d("2026-10-12"), checkOut: d("2026-10-15"), adults: 5, children: 0,
    });
    expect(combination).toBeNull(); // Family alone sleeps 4, and the Standard is busy on the 13th
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
    const found = nextAvailableRanges((a, b) => partyCanStay(index, types, { adults: 2, children: 0 }, a, b, { onlyTypeId: "std" }), {
      after: d("2026-10-12"), nights: 3, withinDays: 60, max: 3, horizon: d("2027-10-06"),
    });
    expect(found).toEqual([]);
  });

  it("returns nothing when no combination or range fits, so the page falls back to /enquiry", () => {
    const index = buildIndex(rooms, [stay("s1", "2026-10-01", "2027-03-01"), stay("f1", "2026-10-01", "2027-03-01")]);
    const out = suggestAlternatives({
      ...base, index, chosenTypeId: "std", checkIn: d("2026-10-12"), checkOut: d("2026-10-15"), adults: 2, children: 0,
    });
    expect(out).toEqual({ combination: null, dateRanges: [] });
  });

  it("with no chosen type, date suggestions use any combination that holds the party", () => {
    const index = buildIndex(rooms, [stay("s1", "2026-10-10", "2026-10-30"), stay("f1", "2026-10-10", "2026-10-25")]);
    const { dateRanges } = suggestAlternatives({
      ...base, index, chosenTypeId: null, checkIn: d("2026-10-12"), checkOut: d("2026-10-14"), adults: 2, children: 0,
    });
    expect(dateRanges[0]).toEqual({ checkIn: d("2026-10-25"), checkOut: d("2026-10-27") });
  });
});

describe("unavailableReason", () => {
  const rooms = [
    { id: "a", roomTypeId: "std" },
    { id: "b", roomTypeId: "std" },
  ];
  it("is null when one room covers the stay", () => {
    expect(unavailableReason(buildIndex(rooms, []), "std", d("2026-10-10"), d("2026-10-13"))).toBeNull();
  });
  it("says sold out when some nights have no free room", () => {
    const index = buildIndex(rooms, [stay("a", "2026-10-11", "2026-10-13"), stay("b", "2026-10-12", "2026-10-14")]);
    expect(unavailableReason(index, "std", d("2026-10-10"), d("2026-10-14"))).toEqual({ kind: "sold-out", soldOutNights: 1, nights: 4 });
  });
  it("says no single room when every night is free in some room but not one room for all", () => {
    const index = buildIndex(rooms, [stay("a", "2026-10-12", "2026-10-13"), stay("b", "2026-10-10", "2026-10-12")]);
    expect(unavailableReason(index, "std", d("2026-10-10"), d("2026-10-13"))).toEqual({ kind: "no-single-room" });
  });
});
