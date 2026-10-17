import { z } from "zod";
import { slugify } from "@/app/admin/rooms/schemas";

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const faqSchema = z
  .array(z.object({ question: z.string().trim().min(1).max(300), answer: z.string().trim().min(1).max(2000) }))
  .max(20);
export type FaqEntry = z.infer<typeof faqSchema>[number];

/** Tags as typed: comma or newline separated, lowercased, de-duplicated. */
export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[,\n]/)) {
    const tag = part.trim().toLowerCase().replace(/\s+/g, " ");
    if (tag) seen.add(tag.slice(0, 40));
  }
  return [...seen].slice(0, 12);
}

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

export const guideInputSchema = z.object({
  id: z.string().trim().optional().default(""),
  title: z.string().trim().min(1, "Add a title.").max(160),
  slug: z.string().trim().max(80).default(""),
  excerpt: z.string().trim().max(400).default(""),
  body: z.string().max(100_000).default(""),
  coverMediaId: z.string().trim().transform((v) => v || null).default(null),
  tags: z.string().default("").transform(parseTags),
  authorName: z.string().trim().max(120).default(""),
  authorRole: optional(120).default(null),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  /** yyyy-mm-dd from a date input, read as a Kathmandu calendar day. */
  publishedAt: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date.")
    .default(""),
  seoTitle: optional(120).default(null),
  seoDescription: optional(320).default(null),
  faq: z
    .string()
    .default("[]")
    .transform((v, ctx) => {
      try {
        const parsed = faqSchema.safeParse(JSON.parse(v || "[]"));
        if (parsed.success) return parsed.data;
      } catch {}
      ctx.addIssue({ code: "custom", message: "Each FAQ needs a question and an answer." });
      return z.NEVER;
    }),
  markReviewed: z.string().optional(),
}).transform((input) => ({ ...input, slug: input.slug || slugify(input.title) }))
  .refine((input) => SLUG_PATTERN.test(input.slug), {
    error: "Use lowercase letters, numbers and single hyphens only.",
    path: ["slug"],
  });
