import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";
import { isStaging } from "@/lib/site-env";

/** Crawlers named explicitly so the policy is visible. A crawler reads only its own group, so each repeats the disallows. */
export const AI_CRAWLERS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"] as const;
const PRIVATE = ["/admin", "/login", "/api/"];

export default function robots(): MetadataRoute.Robots {
  if (isStaging) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow: PRIVATE })),
    ],
    sitemap: new URL("/sitemap.xml", SITE.url).toString(),
    host: SITE.url.origin,
  };
}
