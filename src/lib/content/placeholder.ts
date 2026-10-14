import { showPlaceholders } from "@/lib/site-env";

/**
 * Dev placeholders (AGENTS.md rule 5). Rows carry `placeholderFields`: the names of
 * fields still holding placeholder text. Dev and staging show them with a badge; production hides them.
 */

export { showPlaceholders };

/**
 * Fields that no longer exist in the admin or on the site but may still be named in old
 * `placeholderFields` arrays (their columns are kept). These flags never count and never hide anything.
 */
const RETIRED_FIELDS: Record<string, readonly string[]> = {
  activities: ["summary", "duration", "season", "bestTime", "bestFor", "highlights", "whatToExpect", "howWeHelp", "tip"],
};

/** A row's placeholder flags without the retired fields of its collection. */
export function activeFlags(collection: string, flags: readonly string[] | null | undefined): string[] {
  const retired = RETIRED_FIELDS[collection] ?? [];
  return (flags ?? []).filter((f) => !retired.includes(f));
}

type Flagged = { placeholderFields?: readonly string[] | null };

export function isPlaceholder(row: Flagged, field: string): boolean {
  return !!row.placeholderFields?.includes(field);
}

/** The field's value, or null when it is a placeholder that must not be shown (production). */
export function liveValue<T>(row: Flagged & Record<string, unknown>, field: string): T | null {
  const value = row[field] as T | null | undefined;
  if (value == null) return null;
  if (isPlaceholder(row, field) && !showPlaceholders) return null;
  return value;
}

/** True when a row has a placeholder in any of its required fields (it should be hidden in production). */
export function hasPlaceholderIn(row: Flagged, fields: readonly string[]): boolean {
  return fields.some((f) => isPlaceholder(row, f));
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * After an admin edit: a flagged field stays flagged only while its value is unchanged.
 * Editing the text (or clearing it) means a person has dealt with it.
 */
export function remainingPlaceholders(
  previous: Record<string, unknown> | null,
  next: Record<string, unknown>,
  flagged: readonly string[],
): string[] {
  if (!previous) return [];
  return flagged.filter((field) => same(previous[field], next[field]));
}

/** Flagged images (stand-ins, rights unconfirmed) show in development and staging only; production hides them everywhere. */
export function mediaVisible(media: { isPlaceholder: boolean }, show: boolean = showPlaceholders): boolean {
  return show || !media.isPlaceholder;
}
