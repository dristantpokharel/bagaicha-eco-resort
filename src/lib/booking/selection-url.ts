/**
 * The room selection as it travels in /book URLs, so refresh, back and shared links work.
 *   rooms=deluxe:2:1,family:4:0   one entry per room: type slug, adults, children
 * A room with no type yet is written with "_" as its slug (_:2:0).
 * Anything malformed decodes to null; the server validates the result again.
 */
export type SlugRoom = { slug: string | null; adults: number; children: number };

const SLUG = /^[a-z0-9-]{1,64}$/;
const COUNT = /^\d{1,2}$/;
const MAX_ENTRIES = 20;
const NO_TYPE = "_";

export const encodeRooms = (rooms: SlugRoom[]) => rooms.map((r) => `${r.slug ?? NO_TYPE}:${r.adults}:${r.children}`).join(",");

export function decodeRooms(raw: string | undefined): SlugRoom[] | null {
  if (!raw) return null;
  const parts = raw.split(",");
  if (parts.length > MAX_ENTRIES) return null;
  const rooms: SlugRoom[] = [];
  for (const part of parts) {
    const [slug, adults, children, ...extra] = part.split(":");
    const typed = slug !== NO_TYPE;
    if (extra.length || (typed && !SLUG.test(slug ?? "")) || !COUNT.test(adults ?? "") || !COUNT.test(children ?? "")) return null;
    rooms.push({ slug: typed ? slug : null, adults: Number(adults), children: Number(children) });
  }
  return rooms;
}
