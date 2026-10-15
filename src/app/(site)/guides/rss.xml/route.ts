import { SITE } from "@/config/site";
import { PAGES } from "@/config/site-copy";
import { getBusiness } from "@/lib/content/queries";
import { visibleGuides } from "@/lib/guides/queries";
import { buildRss } from "@/lib/rss";
import { isStaging } from "@/lib/site-env";

export const revalidate = 3600;

export async function GET() {
  if (isStaging) return new Response("Not found", { status: 404 });
  const [business, guides] = await Promise.all([getBusiness(), visibleGuides()]);
  const xml = buildRss({ title: `${business.name} · ${PAGES.guides.title}`, description: PAGES.guides.description, origin: SITE.url.origin, guides });
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
