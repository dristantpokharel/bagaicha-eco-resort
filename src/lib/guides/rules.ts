/** Pure guide rules, safe to import from client components. */

/** Fields that make up what a visitor reads. A placeholder in any of them keeps a guide off the live site. */
export const GUIDE_CONTENT_FIELDS = ["title", "excerpt", "body", "faq", "authorName"] as const;

const WORDS_PER_MINUTE = 200;

/** Whole minutes to read, at least 1. Markdown syntax and image tags do not count as words. */
export function readingMinutes(markdown: string): number {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`~|-]+/g, " ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export type PublishProblem = string;

/** What is still missing before a guide may be published. Empty = ready. */
export function publishProblems(g: {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  authorName: string;
  coverMediaId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  placeholderFields: readonly string[];
}): PublishProblem[] {
  const out: PublishProblem[] = [];
  if (!g.title.trim()) out.push("Add a title.");
  if (!g.slug.trim()) out.push("Add a URL slug.");
  if (!g.excerpt.trim()) out.push("Write an excerpt.");
  if (!g.body.trim()) out.push("Write the body.");
  if (!g.authorName.trim()) out.push("Add the author's name.");
  if (!g.coverMediaId) out.push("Choose a cover image.");
  if (!g.seoTitle?.trim()) out.push("Add an SEO title.");
  if (!g.seoDescription?.trim()) out.push("Add a meta description.");
  const open = g.placeholderFields.filter((f) => (GUIDE_CONTENT_FIELDS as readonly string[]).includes(f));
  if (open.length > 0) out.push(`Replace the placeholder text in: ${open.join(", ")}. Tick "I've reviewed this" once it is real.`);
  return out;
}

/** Length guides shown next to the SEO fields. Hints, not limits. */
export const SEO_HINTS = {
  title: { min: 30, max: 60 },
  description: { min: 120, max: 160 },
} as const;
