import { describe, expect, it } from "vitest";
import { hasPlaceholderIn, isPlaceholder, remainingPlaceholders } from "./placeholder";

describe("placeholder flags", () => {
  const row = { placeholderFields: ["overview", "duration"] };

  it("knows which fields are flagged", () => {
    expect(isPlaceholder(row, "overview")).toBe(true);
    expect(isPlaceholder(row, "summary")).toBe(false);
    expect(isPlaceholder({}, "overview")).toBe(false);
    expect(isPlaceholder({ placeholderFields: null }, "overview")).toBe(false);
  });

  it("detects a placeholder in any required field", () => {
    expect(hasPlaceholderIn(row, ["title", "duration"])).toBe(true);
    expect(hasPlaceholderIn(row, ["title"])).toBe(false);
  });

  it("clears a flag when its field is edited, keeps it when untouched", () => {
    const before = { overview: "Placeholder: x", duration: "Placeholder: y", summary: "Real" };
    const after = { overview: "A real overview", duration: "Placeholder: y", summary: "Real" };
    expect(remainingPlaceholders(before, after, ["overview", "duration"])).toEqual(["duration"]);
  });

  it("treats clearing a field as editing it", () => {
    expect(remainingPlaceholders({ duration: "Placeholder: y" }, { duration: null }, ["duration"])).toEqual([]);
  });

  it("compares lists by value", () => {
    expect(remainingPlaceholders({ amenities: ["a"] }, { amenities: ["a"] }, ["amenities"])).toEqual(["amenities"]);
    expect(remainingPlaceholders({ amenities: ["a"] }, { amenities: ["b"] }, ["amenities"])).toEqual([]);
  });

  it("flags nothing on create", () => {
    expect(remainingPlaceholders(null, { a: 1 }, ["a"])).toEqual([]);
  });
});
