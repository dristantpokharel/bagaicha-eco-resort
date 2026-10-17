import { describe, expect, it } from "vitest";
import { isPubliclyVisible, publishProblems, readingMinutes } from "./visibility";
import { parseTags } from "./schemas";

const now = new Date("2026-10-15T00:00:00Z");
const past = new Date("2026-10-01T00:00:00Z");
const future = new Date("2026-11-01T00:00:00Z");

describe("isPubliclyVisible", () => {
  it("never shows drafts", () => {
    expect(isPubliclyVisible({ status: "DRAFT", publishedAt: past }, now, true)).toBe(false);
  });
  it("hides future-dated and undated guides", () => {
    expect(isPubliclyVisible({ status: "PUBLISHED", publishedAt: future }, now, true)).toBe(false);
    expect(isPubliclyVisible({ status: "PUBLISHED", publishedAt: null }, now, true)).toBe(false);
  });
  it("shows a published, past-dated guide", () => {
    expect(isPubliclyVisible({ status: "PUBLISHED", publishedAt: past, placeholderFields: [] }, now, false)).toBe(true);
  });
  it("hides content placeholders in production only", () => {
    const g = { status: "PUBLISHED" as const, publishedAt: past, placeholderFields: ["body"] };
    expect(isPubliclyVisible(g, now, false)).toBe(false);
    expect(isPubliclyVisible(g, now, true)).toBe(true);
  });
  it("ignores flags on non-content fields", () => {
    expect(isPubliclyVisible({ status: "PUBLISHED", publishedAt: past, placeholderFields: ["seoTitle"] }, now, false)).toBe(true);
  });
});

describe("readingMinutes", () => {
  it("is at least one minute", () => expect(readingMinutes("")).toBe(1));
  it("counts words, not markdown or images", () => {
    const text = "word ".repeat(400) + "![alt text here](https://x.test/a.jpg) [link text](/explore)";
    expect(readingMinutes(text)).toBe(2);
  });
});

describe("publishProblems", () => {
  const ready = {
    title: "T",
    slug: "t",
    excerpt: "e",
    body: "b",
    authorName: "A",
    coverMediaId: "m",
    seoTitle: "s",
    seoDescription: "d",
    placeholderFields: [] as string[],
  };
  it("is empty when complete", () => expect(publishProblems(ready)).toEqual([]));
  it("lists what is missing", () => {
    const problems = publishProblems({ ...ready, authorName: " ", coverMediaId: null, placeholderFields: ["body"] });
    expect(problems).toHaveLength(3);
  });
});

describe("parseTags", () => {
  it("splits, lowercases and de-duplicates", () => expect(parseTags("Birds, birds\n Park ,")).toEqual(["birds", "park"]));
});
