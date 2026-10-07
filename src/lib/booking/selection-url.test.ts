import { describe, expect, it } from "vitest";
import { decodeLines, decodePick, encodeLines, encodePick } from "./selection-url";

describe("selection in the URL", () => {
  it("round-trips room lines", () => {
    const lines = [
      { slug: "family-room", adults: 3, children: 1 },
      { slug: "deluxe", adults: 2, children: 0 },
    ];
    expect(encodeLines(lines)).toBe("family-room:3:1,deluxe:2:0");
    expect(decodeLines(encodeLines(lines))).toEqual(lines);
  });
  it("rejects malformed or oversized lines instead of guessing", () => {
    for (const bad of ["", undefined, "deluxe", "deluxe:2", "deluxe:a:0", "De Luxe:2:0", "deluxe:2:0:1", "deluxe:-1:0", "deluxe:200:0", "a:1:0,,b:1:0"]) {
      expect(decodeLines(bad)).toBeNull();
    }
    expect(decodeLines(Array.from({ length: 21 }, () => "a:1:0").join(","))).toBeNull();
  });
  it("round-trips room counts and drops zeros and junk", () => {
    expect(encodePick({ deluxe: 2, family: 1, std: 0 })).toBe("deluxe:2,family:1");
    expect(decodePick("deluxe:2,family:1")).toEqual({ deluxe: 2, family: 1 });
    expect(decodePick("deluxe:0,??:1,family:x,ok:3:9")).toEqual({});
    expect(decodePick(undefined)).toEqual({});
  });
});
