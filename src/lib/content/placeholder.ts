/**
 * Dev placeholders (AGENTS.md rule 5). Rows carry `placeholderFields`: the names of
 * fields still holding placeholder text. Dev shows them with a badge; production hides them.
 */

type Flagged = { placeholderFields?: readonly string[] | null };

/** Show placeholder text (with a badge) outside production only. */
export const showPlaceholders = process.env.NODE_ENV !== "production";

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
