import { describe, expect, it } from "vitest";
import { isKrishnasaarLive, paragraphs, sectionText } from "./visibility";

const page = (flags: string[]) => ({ title: "T", intro: "I", whatItIs: "W", history: "H", placeholderFields: flags });

describe("isKrishnasaarLive", () => {
  it("is not live without a row", () => expect(isKrishnasaarLive(null, true)).toBe(false));
  it("shows everything in dev", () => expect(isKrishnasaarLive(page(["title", "intro", "whatItIs"]), true)).toBe(true));
  it("hides the whole page in production while title, intro or what-it-is is flagged", () => {
    for (const f of ["title", "intro", "whatItIs"]) expect(isKrishnasaarLive(page([f]), false)).toBe(false);
  });
  it("goes live in production once those three are reviewed, even if other sections are flagged", () => {
    expect(isKrishnasaarLive(page(["history"]), false)).toBe(true);
  });
});

describe("sectionText", () => {
  it("hides a flagged section in production only", () => {
    expect(sectionText(page(["history"]), "history", false)).toBeNull();
    expect(sectionText(page(["history"]), "history", true)).toBe("H");
    expect(sectionText(page([]), "history", false)).toBe("H");
  });
  it("returns null for empty or missing text", () => {
    expect(sectionText({ ...page([]), history: "  " }, "history", true)).toBeNull();
    expect(sectionText(page([]), "wildlife", true)).toBeNull();
  });
});

describe("paragraphs", () => {
  it("splits on blank lines", () => expect(paragraphs("a\n\n b \n\n\nc")).toEqual(["a", "b", "c"]));
  it("handles null", () => expect(paragraphs(null)).toEqual([]));
});
