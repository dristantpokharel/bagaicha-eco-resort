/** Most photos any homepage collage shows. */
export const MAX_COLLAGE = 3;

type HasUrl = { url: string };

/**
 * Events & gatherings photos: the first Events photo (the wedding) leads, the first Conference
 * photo follows, then any further Events photos in their saved order. No duplicates, at most three.
 * Inputs are already filtered for visibility, so a photo hidden in production never appears here.
 */
export function eventsCollage<T extends HasUrl>(events: T[] = [], conference: T[] = []): T[] {
  const [wedding, ...more] = events;
  const seen = new Set<string>();
  return [wedding, conference[0], ...more].filter((p): p is T => !!p && !seen.has(p.url) && !!seen.add(p.url)).slice(0, MAX_COLLAGE);
}
