import type { Business, PublicRoomType } from "@/lib/content/queries";
import type { PublicGuide } from "@/lib/guides/queries";

type Link = { title: string; path: string };

/**
 * /llms.txt: a short plain-text (Markdown) summary for AI assistants. Built only from the database;
 * a line is left out when its fact is not saved.
 */
export function buildLlmsTxt({
  business,
  rooms,
  guides,
  pages,
  origin,
}: {
  business: Business;
  rooms: Pick<PublicRoomType, "name" | "maxGuests" | "maxAdults" | "maxChildren">[];
  guides: Pick<PublicGuide, "title" | "slug" | "excerpt">[];
  pages: Link[];
  origin: string;
}): string {
  const url = (path: string) => new URL(path, origin).toString();
  const lines: string[] = [`# ${business.name}`, ""];
  if (business.intro) lines.push(`> ${business.intro}`, "");

  const facts: string[] = [];
  if (business.address) facts.push(`- Location: ${business.address}`);
  if (business.checkInTime) facts.push(`- Check-in: ${business.checkInTime}`);
  if (business.checkOutTime) facts.push(`- Check-out: ${business.checkOutTime}`);
  if (business.phones.length) facts.push(`- Phone: ${business.phones.join(", ")}`);
  if (business.whatsapp) facts.push(`- WhatsApp: +${business.whatsapp}`);
  if (business.emails.length) facts.push(`- Email: ${business.emails.join(", ")}`);
  if (business.latitude != null && business.longitude != null) facts.push(`- Coordinates: ${business.latitude}, ${business.longitude}`);
  if (facts.length) lines.push("## Essentials", ...facts, "");

  if (rooms.length) {
    lines.push("## Rooms");
    for (const r of rooms) {
      const parts = [`up to ${r.maxGuests} guests`, `${r.maxAdults} adults`];
      if (r.maxChildren != null) parts.push(`${r.maxChildren} children`);
      lines.push(`- ${r.name}: ${parts.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("## Key pages", ...pages.map((p) => `- [${p.title}](${url(p.path)})`), "");

  if (guides.length) {
    lines.push("## Guides");
    for (const g of guides) lines.push(`- [${g.title}](${url(`/guides/${g.slug}`)})${g.excerpt ? `: ${g.excerpt.replace(/\s+/g, " ")}` : ""}`);
    lines.push("");
  }
  return lines.join("\n");
}
