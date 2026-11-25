import { formatWhatsapp, mailHref, telHref, whatsappHref } from "@/lib/content/contact";
import { escapeHtml as esc } from "./escape";

/** The resort's contact facts for the foot of a guest email. A missing fact is simply left out. */
export type EmailContact = {
  name: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  websiteUrl: string | null;
  mapsUrl: string | null;
};

const safeHref = (url: string) => (/^https?:\/\//i.test(url) ? url : null);

type Entry = { label: string; value: string; href: string | null };

function entries(c: EmailContact): Entry[] {
  const out: Entry[] = [];
  if (c.phone) out.push({ label: "Phone", value: c.phone, href: telHref(c.phone) });
  if (c.whatsapp) out.push({ label: "WhatsApp", value: formatWhatsapp(c.whatsapp), href: whatsappHref(c.whatsapp) });
  if (c.email) out.push({ label: "Bookings", value: c.email, href: mailHref(c.email) });
  if (c.websiteUrl) out.push({ label: "Website", value: c.websiteUrl, href: safeHref(c.websiteUrl) });
  if (c.mapsUrl) out.push({ label: "Find us on Google Maps", value: c.mapsUrl, href: safeHref(c.mapsUrl) });
  return out;
}

/** The contact footer shared by every guest email and invoice: HTML and plain text. */
export function renderEmailFooter(c: EmailContact, colors: { muted: string; line: string; forest: string }): { html: string; text: string } {
  const rows = entries(c);
  const html = `<hr style="border:none;border-top:1px solid ${colors.line};margin:24px 0 12px">
<div style="font-size:12px;line-height:1.6;color:${colors.muted}">
<div style="font-weight:bold;color:${colors.forest}">${esc(c.name)}</div>${c.address ? `\n<div>${esc(c.address)}</div>` : ""}${rows
    .map((r) => `\n<div>${esc(r.label)}: ${r.href ? `<a href="${esc(r.href)}" style="color:${colors.forest}">${esc(r.value)}</a>` : esc(r.value)}</div>`)
    .join("")}
</div>`;
  const text = [c.name, ...(c.address ? [c.address] : []), ...rows.map((r) => `${r.label}: ${r.value}`)].join("\n");
  return { html, text };
}
