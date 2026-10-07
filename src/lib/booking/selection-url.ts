/**
 * The room selection as it travels in /book URLs, so refresh, back and shared links work.
 *   lines=family:3:1,deluxe:2:0   one entry per room: type slug, adults, children (goes to the guest form)
 *   pick=deluxe:2,family:1        how many rooms of each type are selected (goes to the room chooser)
 * Anything malformed decodes to null / nothing; the server validates the result again.
 */
export type SlugLine = { slug: string; adults: number; children: number };

const SLUG = /^[a-z0-9-]{1,64}$/;
const COUNT = /^\d{1,2}$/;
const MAX_ENTRIES = 20;

export const encodeLines = (lines: SlugLine[]) => lines.map((l) => `${l.slug}:${l.adults}:${l.children}`).join(",");

export function decodeLines(raw: string | undefined): SlugLine[] | null {
  if (!raw) return null;
  const parts = raw.split(",");
  if (parts.length > MAX_ENTRIES) return null;
  const lines: SlugLine[] = [];
  for (const part of parts) {
    const [slug, adults, children, ...extra] = part.split(":");
    if (extra.length || !SLUG.test(slug ?? "") || !COUNT.test(adults ?? "") || !COUNT.test(children ?? "")) return null;
    lines.push({ slug, adults: Number(adults), children: Number(children) });
  }
  return lines;
}

export function encodePick(counts: Record<string, number>): string {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([slug, n]) => `${slug}:${n}`)
    .join(",");
}

export function decodePick(raw: string | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw) return out;
  for (const part of raw.split(",").slice(0, MAX_ENTRIES)) {
    const [slug, n, ...extra] = part.split(":");
    if (!extra.length && SLUG.test(slug ?? "") && COUNT.test(n ?? "") && Number(n) > 0) out[slug] = Number(n);
  }
  return out;
}
