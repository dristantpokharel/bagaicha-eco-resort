import type { MetadataRoute } from "next";
import { notFound } from "next/navigation";
import { SITE } from "@/config/site";
import { FOOTER_NAV, KRISHNASAAR } from "@/config/site-copy";
import { visibleGuides } from "@/lib/guides/queries";
import { isKrishnasaarPublic } from "@/lib/krishnasaar/queries";
import { isStaging } from "@/lib/site-env";

/** Public pages only (admin and login are not listed). URLs come from NEXT_PUBLIC_SITE_URL. */
const PATHS = [...FOOTER_NAV.map((n) => n.href), "/book", "/enquiry"];

/** /krishnasaar is listed only while it is live (title, intro and "what it is" reviewed). */
export function sitemapPaths(krishnasaarLive: boolean) {
  return krishnasaarLive ? [...PATHS, KRISHNASAAR.path] : PATHS;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isStaging) notFound(); // no sitemap on staging
  const pages: MetadataRoute.Sitemap = sitemapPaths(await isKrishnasaarPublic()).map((path) => ({
    url: new URL(path, SITE.url).toString(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/book" ? 0.9 : 0.7,
  }));
  const guides = await visibleGuides();
  return [
    ...pages,
    ...guides.map((g) => ({
      url: new URL(`/guides/${g.slug}`, SITE.url).toString(),
      lastModified: g.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
