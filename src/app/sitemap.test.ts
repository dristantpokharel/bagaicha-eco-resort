import { describe, expect, it } from "vitest";
import { FOOTER_NAV, NAV } from "@/config/site-copy";
import robots from "./robots";
import sitemap from "./sitemap";

describe("sitemap and robots", () => {
  it("lists every nav page, the booking pages, and never admin or login", () => {
    const paths = sitemap().map((e) => new URL(e.url).pathname);
    for (const item of FOOTER_NAV) expect(paths).toContain(item.href);
    expect(paths).toEqual(expect.arrayContaining(["/book", "/enquiry"]));
    expect(paths.some((p) => p.startsWith("/admin") || p === "/login")).toBe(false);
  });

  it("header links are a subset of footer links, so no link is missing from the footer", () => {
    const footer = new Set<string>(FOOTER_NAV.map((n) => n.href));
    for (const item of NAV) expect(footer.has(item.href)).toBe(true);
  });

  it("keeps admin and login out of search and points to the sitemap", () => {
    const r = robots();
    expect(r.rules).toMatchObject({ disallow: expect.arrayContaining(["/admin", "/login"]) });
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
