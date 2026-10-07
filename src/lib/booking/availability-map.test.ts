import { describe, expect, it } from "vitest";
import {
  buildAvailabilityPayload,
  buildIndex,
  freeCountsByNight,
  freeRoomCount,
  latestCheckOut,
  soldOutForRooms,
  soldOutNights,
  typeIsBookable,
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

describe("calendar shading for the rooms chosen", () => {
  // Standard: s1 busy 10th-11th, s2 busy 11th-12th. Family: f1 busy 11th-12th.
  const rooms = [
    { id: "s1", roomTypeId: "std" },
    { id: "s2", roomTypeId: "std" },
    { id: "f1", roomTypeId: "fam" },
  ];
  const index = buildIndex(rooms, [
    stay("s1", "2026-10-10", "2026-10-11"),
    stay("s2", "2026-10-11", "2026-10-12"),
    stay("f1", "2026-10-11", "2026-10-12"),
  ]);
  const payload = buildAvailabilityPayload(types, index, d("2026-10-10"), 4);
  const sold = (...chosen: string[]) => [...soldOutForRooms(payload, chosen)];

  it("exposes only room counts and free rooms per night, capped", () => {
    expect(payload.types.map((t) => Object.keys(t).sort())).toEqual([
      ["free", "maxAdults", "maxChildren", "maxGuests", "name", "rooms", "slug"],
      ["free", "maxAdults", "maxChildren", "maxGuests", "name", "rooms", "slug"],
    ]);
    expect(payload.types.map((t) => t.free)).toEqual(["1122", "1011"]);
    const many = buildAvailabilityPayload([standard], buildIndex(Array.from({ length: 7 }, (_, i) => ({ id: `r${i}`, roomTypeId: "std" })), []), d("2026-10-10"), 1);
    expect(many.types[0].free).toBe("4"); // 7 free, capped at the 4-room limit
  });
  it("with no type chosen, shades only the nights where nothing at all is free", () => {
    expect(sold()).toEqual([]); // the 11th still has a free Standard
    const full = buildIndex(rooms, [stay("s1", "2026-10-10", "2026-10-12"), stay("s2", "2026-10-10", "2026-10-12"), stay("f1", "2026-10-10", "2026-10-12")]);
    expect([...soldOutForRooms(buildAvailabilityPayload(types, full, d("2026-10-10"), 3), [])]).toEqual(["2026-10-10", "2026-10-11"]);
  });
  it("one chosen type is shaded where none of its rooms is free", () => {
    expect(sold("fam")).toEqual(["2026-10-11"]);
    expect(sold("std")).toEqual([]);
  });
  it("two rooms of one type need two distinct free rooms on the night", () => {
    expect(sold("std", "std")).toEqual(["2026-10-10", "2026-10-11"]); // only one Standard free on each of those nights
  });
  it("a mix needs every chosen type free, each in its own room", () => {
    expect(sold("std", "fam")).toEqual(["2026-10-11"]);
    expect(sold("std", "std", "fam")).toEqual(["2026-10-10", "2026-10-11"]);
  });
  it("ignores slugs it doesn't know", () => {
    expect(sold("ghost")).toEqual([]);
  });
});
