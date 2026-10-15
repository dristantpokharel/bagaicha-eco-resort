import { describe, expect, it } from "vitest";
import { buildLlmsTxt } from "./llms";
import { buildRss, escapeXml } from "./rss";

const business = {
  name: "Test Resort", tagline: null, intro: "A place.", address: "Somewhere, Nepal", phones: ["123"], whatsapp: "9770000", emails: ["a@b.test"],
  instagramUrl: null, facebookUrl: null, googleMapsUrl: null, directionsUrl: null, checkInTime: "2:00 PM", checkOutTime: null, latitude: null, longitude: null,
};

describe("buildLlmsTxt", () => {
  const text = buildLlmsTxt({
    business,
    rooms: [{ name: "Cottage", maxGuests: 3, maxAdults: 2, maxChildren: 1 }],
    guides: [{ title: "Hello", slug: "hello", excerpt: "Line one\nline two" }],
    pages: [{ title: "Stay", path: "/stay" }],
    origin: "https://example.test",
  });
  it("includes the facts it has and links", () => {
    expect(text).toContain("# Test Resort");
    expect(text).toContain("- Check-in: 2:00 PM");
    expect(text).toContain("- Cottage: up to 3 guests, 2 adults, 1 children");
    expect(text).toContain("[Stay](https://example.test/stay)");
    expect(text).toContain("[Hello](https://example.test/guides/hello): Line one line two");
  });
  it("leaves out facts that are not saved", () => {
    expect(text).not.toContain("Check-out");
    expect(text).not.toContain("Coordinates");
  });
});

describe("buildRss", () => {
  it("escapes text and lists items", () => {
    expect(escapeXml(`<a href="x">&`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;");
    const xml = buildRss({
      title: "T & Co", description: "d", origin: "https://example.test",
      guides: [{ title: "<b>x</b>", slug: "x", excerpt: "e", publishedAt: new Date("2026-10-01T00:00:00Z"), updatedAt: new Date("2026-10-02T00:00:00Z"), authorName: "A", tags: ["t"] }],
    });
    expect(xml).toContain("<title>T &amp; Co</title>");
    expect(xml).toContain("<title>&lt;b&gt;x&lt;/b&gt;</title>");
    expect(xml).toContain("https://example.test/guides/x");
    expect(xml).toContain("<category>t</category>");
  });
});
