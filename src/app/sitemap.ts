import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";
import { FOOTER_NAV } from "@/config/site-copy";

/** Public pages only (admin and login are not listed). URLs come from NEXT_PUBLIC_SITE_URL. */
const PATHS = [...FOOTER_NAV.map((n) => n.href), "/book", "/enquiry"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({
    url: new URL(path, SITE.url).toString(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/book" ? 0.9 : 0.7,
  }));
}
