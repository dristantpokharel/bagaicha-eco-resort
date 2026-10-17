import { describe, expect, it } from "vitest";
import { eventsCollage } from "./collage";

const p = (url: string) => ({ url });

describe("eventsCollage", () => {
  it("puts the wedding first, the conference photo second, then more Events photos", () => {
    expect(eventsCollage([p("w"), p("e2"), p("e3")], [p("c")]).map((x) => x.url)).toEqual(["w", "c", "e2"]);
  });
  it("shows one photo alone when only one is clear", () => {
    expect(eventsCollage([p("w")], [])).toEqual([p("w")]);
    expect(eventsCollage([], [p("c")])).toEqual([p("c")]);
  });
  it("returns nothing when no photo is visible", () => {
    expect(eventsCollage([], [])).toEqual([]);
    expect(eventsCollage()).toEqual([]);
  });
  it("never repeats a photo", () => {
    expect(eventsCollage([p("w")], [p("w")]).map((x) => x.url)).toEqual(["w"]);
  });
});
