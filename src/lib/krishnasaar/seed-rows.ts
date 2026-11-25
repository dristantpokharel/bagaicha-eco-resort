import type { PrismaClient } from "@/generated/prisma/client";
import { KRISHNASAAR_FAQS, KRISHNASAAR_FLAGGED, KRISHNASAAR_SEED } from "./seed-content";

/**
 * Creation of the Krishnasaar starter rows, shared by `npm run seed:krishnasaar` and
 * `npm run krishnasaar:load -- --create-page-row`, so both make exactly the same rows.
 * Creates only what is missing and never modifies an existing row.
 */

/** Works with a client or a transaction. */
export type SeedDb = Pick<PrismaClient, "krishnasaarPage" | "krishnasaarFaq">;

/** The page row exactly as the seed creates it: starter text, every text field flagged "verify". */
export function pageRowData() {
  return { id: 1, ...KRISHNASAAR_SEED, relatedGuides: [...KRISHNASAAR_SEED.relatedGuides], placeholderFields: [...KRISHNASAAR_FLAGGED] };
}

/** The five starter question rows as the seed creates them (both fields flagged). */
export function faqRowsData() {
  return KRISHNASAAR_FAQS.map((f, i) => ({ question: f.question, answer: f.answer, sortOrder: i, placeholderFields: ["question", "answer"] }));
}

/** What is missing: the page row, and the question rows (seeded only into an empty table). */
export async function missingSeedRows(db: SeedDb) {
  const [page, faqCount] = await Promise.all([db.krishnasaarPage.findUnique({ where: { id: 1 }, select: { id: true } }), db.krishnasaarFaq.count()]);
  return { pageMissing: !page, faqsMissing: faqCount === 0 };
}

export async function createPageRow(db: SeedDb) {
  await db.krishnasaarPage.create({ data: pageRowData() });
}

export async function createFaqRows(db: SeedDb) {
  for (const data of faqRowsData()) await db.krishnasaarFaq.create({ data });
}
