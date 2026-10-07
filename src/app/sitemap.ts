import type { MetadataRoute } from "next";
import { notFound } from "next/navigation";
import { SITE } from "@/config/site";
import { FOOTER_NAV } from "@/config/site-copy";
import { isStaging } from "@/lib/site-env";

/** Public pages only (admin and login are not listed). URLs come from NEXT_PUBLIC_SITE_URL. */
const PATHS = [...FOOTER_NAV.map((n) => n.href), "/book", "/enquiry"];

export default function sitemap(): MetadataRoute.Sitemap {
  if (isStaging) notFound(); // no sitemap on staging
  return PATHS.map((path) => ({
    url: new URL(path, SITE.url).toString(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/book" ? 0.9 : 0.7,
  }));
}
