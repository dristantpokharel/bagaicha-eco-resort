import { afterEach, describe, expect, it, vi } from "vitest";
import { FOOTER_NAV, NAV } from "@/config/site-copy";
import robots from "./robots";
import sitemap from "./sitemap";

vi.mock("@/lib/guides/queries", () => ({
  visibleGuides: async () => [{ slug: "a-guide", updatedAt: new Date("2026-10-01T00:00:00Z") }],
}));

describe("sitemap and robots", () => {
  it("lists every nav page, the booking pages, and never admin or login", async () => {
    const paths = (await sitemap()).map((e) => new URL(e.url).pathname);
    for (const item of FOOTER_NAV) expect(paths).toContain(item.href);
    expect(paths).toEqual(expect.arrayContaining(["/book", "/enquiry", "/guides"]));
    expect(paths.some((p) => p.startsWith("/admin") || p === "/login")).toBe(false);
  });

  it("lists published guides with their last-modified date", async () => {
    const entry = (await sitemap()).find((e) => e.url.endsWith("/guides/a-guide"));
    expect(entry?.lastModified).toEqual(new Date("2026-10-01T00:00:00Z"));
  });

  it("header links are a subset of footer links, so no link is missing from the footer", () => {
    const footer = new Set<string>(FOOTER_NAV.map((n) => n.href));
    for (const item of NAV) expect(footer.has(item.href)).toBe(true);
  });

  it("keeps admin and login out of search for every crawler and points to the sitemap", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    for (const agent of ["*", "GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"]) {
      const rule = rules.find((x) => x.userAgent === agent);
      expect(rule, agent).toMatchObject({ allow: "/", disallow: expect.arrayContaining(["/admin", "/login"]) });
    }
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/);
  });

  it("on staging: robots disallows everything and the sitemap is disabled", async () => {
    vi.stubEnv("SITE_ENV", "staging");
    vi.resetModules();
    const staging = await import("./robots");
    const stagingSitemap = await import("./sitemap");
    expect(staging.default()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    await expect(stagingSitemap.default()).rejects.toThrow();
  });
});

afterEach(() => vi.unstubAllEnvs());
