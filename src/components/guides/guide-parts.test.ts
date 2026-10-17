import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GuideCard } from "./guide-parts";

const guide = { slug: "a", title: "A guide", excerpt: "x", cover: null, publishedAt: new Date("2026-10-01T00:00:00Z"), readingMinutes: 2, tags: [] };

describe("GuideCard", () => {
  it("reserves no image frame when the guide has no visible cover", () => {
    const html = renderToStaticMarkup(createElement(GuideCard, { guide }));
    expect(html).not.toMatch(/aspect-|bg-sage|<img/);
    expect(html).toContain("A guide");
  });
});
