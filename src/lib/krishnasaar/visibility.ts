/**
 * The one rule for what the public sees of /krishnasaar. Flagged text is a "verify" placeholder
 * (AGENTS.md rule 5): shown with a badge in dev and staging, hidden in production.
 */

/** Fields that must be reviewed before the page exists at all in production. */
export const KRISHNASAAR_GATE_FIELDS = ["title", "intro", "whatItIs"] as const;

type Flagged = { placeholderFields?: readonly string[] | null };

export function isKrishnasaarLive(page: (Flagged & { isActive?: boolean }) | null, show: boolean): boolean {
  if (!page) return false;
  if (show) return true;
  return !KRISHNASAAR_GATE_FIELDS.some((f) => page.placeholderFields?.includes(f));
}

/** A section's text, or null when it is empty or still flagged in production. */
export function sectionText(page: Flagged & Record<string, unknown>, field: string, show: boolean): string | null {
  const value = page[field];
  if (typeof value !== "string" || !value.trim()) return null;
  if (!show && page.placeholderFields?.includes(field)) return null;
  return value;
}

/** Paragraphs split on blank lines. */
export function paragraphs(text: string | null): string[] {
  return (text ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}
