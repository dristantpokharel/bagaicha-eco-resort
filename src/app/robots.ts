import type { MetadataRoute } from "next";
import { SITE } from "@/config/site";
import { isStaging } from "@/lib/site-env";

export default function robots(): MetadataRoute.Robots {
  if (isStaging) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/login", "/api/"] },
    sitemap: new URL("/sitemap.xml", SITE.url).toString(),
    host: SITE.url.origin,
  };
}
