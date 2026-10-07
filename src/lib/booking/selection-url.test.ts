import { describe, expect, it } from "vitest";
import { decodeRooms, encodeRooms } from "./selection-url";

describe("selection in the URL", () => {
  it("round-trips rooms, including one with no type yet", () => {
    const rooms = [
      { slug: "family-room", adults: 3, children: 1 },
      { slug: null, adults: 2, children: 0 },
      { slug: "deluxe", adults: 2, children: 0 },
    ];
    expect(encodeRooms(rooms)).toBe("family-room:3:1,_:2:0,deluxe:2:0");
    expect(decodeRooms(encodeRooms(rooms))).toEqual(rooms);
  });
  it("matches the documented example", () => {
    expect(decodeRooms("deluxe:2:1,family:4:0")).toEqual([
      { slug: "deluxe", adults: 2, children: 1 },
      { slug: "family", adults: 4, children: 0 },
    ]);
  });
  it("rejects malformed or oversized input instead of guessing", () => {
    for (const bad of ["", undefined, "deluxe", "deluxe:2", "deluxe:a:0", "De Luxe:2:0", "deluxe:2:0:1", "deluxe:-1:0", "deluxe:200:0", "a:1:0,,b:1:0", "__:2:0"]) {
      expect(decodeRooms(bad)).toBeNull();
    }
    expect(decodeRooms(Array.from({ length: 21 }, () => "a:1:0").join(","))).toBeNull();
  });
});
