import { showPlaceholders } from "@/lib/site-env";
import { GUIDE_CONTENT_FIELDS } from "./rules";

type Visible = {
  status: "DRAFT" | "PUBLISHED";
  publishedAt: Date | null;
  placeholderFields?: readonly string[] | null;
};

/**
 * The one rule for "can the public see this guide". Drafts never show. A published guide shows
 * once its date has passed. Placeholder text blocks it in production only (AGENTS.md rule 5).
 */
export function isPubliclyVisible(guide: Visible, now: Date = new Date(), show: boolean = showPlaceholders): boolean {
  if (guide.status !== "PUBLISHED") return false;
  if (!guide.publishedAt || guide.publishedAt > now) return false;
  if (show) return true;
  return !GUIDE_CONTENT_FIELDS.some((f) => guide.placeholderFields?.includes(f));
}

export { readingMinutes, publishProblems, SEO_HINTS } from "./rules";
