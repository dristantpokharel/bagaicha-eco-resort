import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import type { Guide } from "@/generated/prisma/client";
import { RESORT_TIMEZONE } from "@/lib/dates";
import { loadPickerLibrary } from "@/lib/media-queries";
import { faqSchema } from "@/lib/guides/schemas";
import type { GuideFormValues } from "./guide-editor";

export const loadLibrary = loadPickerLibrary;

export function toFormValues(g: Guide): GuideFormValues {
  return {
    id: g.id,
    title: g.title,
    slug: g.slug,
    excerpt: g.excerpt,
    body: g.body,
    coverMediaId: g.coverMediaId,
    tags: g.tags.join(", "),
    authorName: g.authorName,
    authorRole: g.authorRole ?? "",
    status: g.status,
    publishedAt: g.publishedAt ? formatInTimeZone(g.publishedAt, RESORT_TIMEZONE, "yyyy-MM-dd") : "",
    seoTitle: g.seoTitle ?? "",
    seoDescription: g.seoDescription ?? "",
    faq: faqSchema.catch([]).parse(g.faq),
    placeholderFields: g.placeholderFields,
  };
}
