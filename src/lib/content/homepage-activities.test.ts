import { describe, expect, it } from "vitest";
import { selectHomepageActivities } from "./homepage-activities";

const activity = (title: string, homepageOrder: number, extra: Partial<{ showOnHomepage: boolean; hasPlaceholder: boolean; hasPhoto: boolean }> = {}) => ({
  title,
  homepageOrder,
  showOnHomepage: extra.showOnHomepage ?? true,
  hasPlaceholder: extra.hasPlaceholder ?? false,
  cover: extra.hasPhoto === false ? null : {},
});

describe("selectHomepageActivities", () => {
  it("includes selected non-placeholder activities from any group order and sorts by homepage order", () => {
    const selected = selectHomepageActivities([
      activity("Day trip", 2),
      activity("At Bagaicha", 1),
      activity("Close by", 0),
    ]);
    expect(selected.map(({ title }) => title)).toEqual(["Close by", "At Bagaicha", "Day trip"]);
  });

  it("filters unselected and placeholder activities, then caps the band at four", () => {
    const selected = selectHomepageActivities([
      activity("placeholder", 0, { hasPlaceholder: true }),
      activity("not selected", 1, { showOnHomepage: false }),
      ...["A", "B", "C", "D", "E"].map((title, i) => activity(title, i + 2)),
    ]);
    expect(selected.map(({ title }) => title)).toEqual(["A", "B", "C", "D"]);
    expect(selectHomepageActivities([activity("placeholder", 0, { hasPlaceholder: true })], true)).toEqual([]);
  });

  it("skips missing photos outside development so no placeholder tile ships", () => {
    const selected = selectHomepageActivities([
      activity("no photo", 0, { hasPhoto: false }),
      activity("has photo", 1),
    ], false);
    expect(selected.map(({ title }) => title)).toEqual(["has photo"]);
    expect(selectHomepageActivities([activity("no photo", 0, { hasPhoto: false })], true)).toHaveLength(1);
  });
});
