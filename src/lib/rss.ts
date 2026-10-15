import type { PublicGuide } from "@/lib/guides/queries";

export const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** RSS 2.0 feed of guides, newest first. Every text value is XML-escaped. */
export function buildRss({
  title,
  description,
  origin,
  guides,
}: {
  title: string;
  description: string;
  origin: string;
  guides: Pick<PublicGuide, "title" | "slug" | "excerpt" | "publishedAt" | "updatedAt" | "authorName" | "tags">[];
}): string {
  const link = new URL("/guides", origin).toString();
  const items = guides.map((g) => {
    const url = new URL(`/guides/${g.slug}`, origin).toString();
    return [
      "    <item>",
      `      <title>${escapeXml(g.title)}</title>`,
      `      <link>${escapeXml(url)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
      `      <pubDate>${g.publishedAt.toUTCString()}</pubDate>`,
      `      <description>${escapeXml(g.excerpt)}</description>`,
      `      <author>${escapeXml(g.authorName)}</author>`,
      ...g.tags.map((t) => `      <category>${escapeXml(t)}</category>`),
      "    </item>",
    ].join("\n");
  });
  const last = guides.reduce<Date | null>((m, g) => (!m || g.updatedAt > m ? g.updatedAt : m), null);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(link)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    "    <language>en</language>",
    last ? `    <lastBuildDate>${last.toUTCString()}</lastBuildDate>` : "",
    `    <atom:link href="${escapeXml(new URL("/guides/rss.xml", origin).toString())}" rel="self" type="application/rss+xml" />`,
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].filter((l) => l !== "").join("\n");
}
