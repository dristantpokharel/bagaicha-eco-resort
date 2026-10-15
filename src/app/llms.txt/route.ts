import { SITE } from "@/config/site";
import { getBusiness, getRoomTypes } from "@/lib/content/queries";
import { visibleGuides } from "@/lib/guides/queries";
import { buildLlmsTxt } from "@/lib/llms";
import { isStaging } from "@/lib/site-env";

export const revalidate = 3600;

const PAGES = [
  { title: "Stay", path: "/stay" },
  { title: "Explore", path: "/explore" },
  { title: "Dine", path: "/dine" },
  { title: "Events", path: "/events" },
  { title: "Location", path: "/location" },
  { title: "Contact", path: "/contact" },
  { title: "FAQ", path: "/faq" },
  { title: "Book", path: "/book" },
  { title: "Guides", path: "/guides" },
];

/** Production only: staging is hidden from search and AI crawlers alike. */
export async function GET() {
  if (isStaging) return new Response("Not found", { status: 404 });
  const [business, rooms, guides] = await Promise.all([getBusiness(), getRoomTypes(), visibleGuides()]);
  const body = buildLlmsTxt({ business, rooms, guides, pages: PAGES, origin: SITE.url.origin });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
