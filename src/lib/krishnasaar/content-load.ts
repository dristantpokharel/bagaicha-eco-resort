/**
 * Pure logic for `npm run krishnasaar:load` (scripts/krishnasaar-load.ts): reading the owner-approved
 * text in docs/krishnasaar-content.md and deciding, per field, what the load would do. No database here.
 */

export const DESTINATION_NAME = "Blackbuck / Krishnasaar Conservation Area";

/** Markdown heading → column on KrishnasaarPage. */
const SECTION_FIELDS = {
  "Page title": "title",
  Intro: "intro",
  "What it is": "whatItIs",
  "History and conservation": "history",
  "Wildlife and best season": "wildlife",
  "Best time to visit": "bestTime",
  "Getting there": "gettingThere",
  "What to bring": "whatToBring",
} as const;

export type PageField = (typeof SECTION_FIELDS)[keyof typeof SECTION_FIELDS];

export const PAGE_FIELDS = Object.values(SECTION_FIELDS) as PageField[];

const SETTINGS = "Settings";
const FAQ_HEADING = "Questions and answers";
export const FAQ_COUNT = 5;

export type ParsedContent = {
  fields: Record<PageField, string>;
  destinationName: string;
  heroFilename: string;
  galleryFilenames: string[];
  faqs: { question: string; answer: string }[];
};

const clean = (text: string) => text.replace(/\r\n?/g, "\n");

/** Splits the file into its named blocks. Headings are lines that are exactly a known heading. */
function blocks(markdown: string): Map<string, string[]> {
  const known = new Set<string>([...Object.keys(SECTION_FIELDS), SETTINGS, FAQ_HEADING]);
  const out = new Map<string, string[]>();
  let current: string[] | null = null;
  for (const raw of clean(markdown).split("\n")) {
    const line = raw.trimEnd();
    if (known.has(line.trim()) && !out.has(line.trim())) {
      current = [];
      out.set(line.trim(), current);
    } else current?.push(line);
  }
  return out;
}

/** The block's text without leading/trailing blank lines; blank-line runs shrink to one blank line. */
const body = (lines: string[]) => lines.join("\n").trim().replace(/\n{3,}/g, "\n\n");

export function parseContent(markdown: string): ParsedContent {
  const parts = blocks(markdown);
  const fields = {} as Record<PageField, string>;
  for (const [heading, field] of Object.entries(SECTION_FIELDS)) {
    const lines = parts.get(heading);
    const text = lines ? body(lines) : "";
    if (!text) throw new Error(`Section "${heading}" is missing or empty in the content file.`);
    fields[field as PageField] = text;
  }

  const settings = Object.fromEntries(
    (parts.get(SETTINGS) ?? []).map((l) => l.trim()).filter(Boolean).map((l) => {
      const i = l.indexOf(":");
      return i < 0 ? ["", ""] : [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
  ) as Record<string, string>;
  const destinationName = settings["Where it is"];
  const heroFilename = settings["Hero photo"];
  const galleryFilenames = (settings.Gallery ?? "").split(",").map((f) => f.trim()).filter(Boolean);
  if (!destinationName) throw new Error('"Where it is" is missing under Settings.');
  if (!heroFilename) throw new Error('"Hero photo" is missing under Settings.');
  if (galleryFilenames.length === 0) throw new Error('"Gallery" is missing under Settings.');

  const faqLines = (parts.get(FAQ_HEADING) ?? []).map((l) => l.trim());
  const faqs: ParsedContent["faqs"] = [];
  // Pairs are separated by blank lines: question on the first line, answer on the rest.
  for (const chunk of faqLines.join("\n").split(/\n\s*\n/).map((c) => c.trim()).filter(Boolean)) {
    const [question, ...answer] = chunk.split("\n");
    faqs.push({ question: question.trim(), answer: answer.join("\n").trim() });
  }
  if (faqs.length !== FAQ_COUNT || faqs.some((f) => !f.question || !f.answer)) {
    throw new Error(`Expected ${FAQ_COUNT} question and answer pairs under "${FAQ_HEADING}", found ${faqs.length}.`);
  }
  return { fields, destinationName, heroFilename, galleryFilenames, faqs };
}

// ─── Planning ────────────────────────────────────────────────────────────────

export type Status = "set" | "unchanged" | "skipped";
export type Decision = { name: string; status: Status; reason?: string };

type Flagged = { value: string | null; flagged: boolean };

/**
 * One text field. A flagged field is replaced (and unflagged). A field a person already edited
 * (flag cleared) is left alone and reported, unless `overwrite`. Identical and unflagged: unchanged.
 */
export function decideText(name: string, current: Flagged, next: string, overwrite: boolean): Decision {
  if (current.value === next && !current.flagged) return { name, status: "unchanged" };
  if (current.value === next) return { name, status: "set", reason: "text already matches; verify flag cleared" };
  if (!current.flagged && !overwrite) return { name, status: "skipped", reason: "already edited (use --overwrite to replace)" };
  return { name, status: "set", reason: current.flagged ? undefined : "overwritten" };
}

/** A link (destination or hero photo): fill it when empty, replace a different one only with `overwrite`. */
export function decideLink(name: string, currentId: string | null, nextId: string | null, missing: string | null, overwrite: boolean): Decision {
  if (!nextId) return { name, status: "skipped", reason: missing ?? "not found" };
  if (currentId === nextId) return { name, status: "unchanged" };
  if (currentId && !overwrite) return { name, status: "skipped", reason: "already set to something else (use --overwrite to replace)" };
  return { name, status: "set" };
}

export type MediaRow = { id: string; originalFilename: string | null };

/** Looks each filename up in the target's media library. Not found or ambiguous names are skipped and listed. */
export function resolveMedia(filenames: readonly string[], library: readonly MediaRow[]) {
  const found = new Map<string, string>();
  const problems: { filename: string; reason: string }[] = [];
  for (const filename of new Set(filenames)) {
    const matches = library.filter((m) => m.originalFilename === filename);
    if (matches.length === 1) found.set(filename, matches[0].id);
    else problems.push({ filename, reason: matches.length === 0 ? "not found in this database's media library" : `${matches.length} media rows share this filename` });
  }
  return { found, problems };
}

/** Gallery: add the resolved photos not already there, after the existing ones, in file order. */
export function planGallery(filenames: readonly string[], found: ReadonlyMap<string, string>, existingMediaIds: readonly string[]) {
  const have = new Set(existingMediaIds);
  const decisions: Decision[] = [];
  const add: string[] = [];
  for (const filename of filenames) {
    const id = found.get(filename);
    if (!id) decisions.push({ name: `gallery: ${filename}`, status: "skipped", reason: "media not found" });
    else if (have.has(id) || add.includes(id)) decisions.push({ name: `gallery: ${filename}`, status: "unchanged" });
    else {
      add.push(id);
      decisions.push({ name: `gallery: ${filename}`, status: "set" });
    }
  }
  return { decisions, add };
}

export type FaqRow = { id: string; question: string; answer: string; placeholderFields: string[] };
export type FaqPlan = { decisions: Decision[]; writes: { index: number; id: string | null; question: string; answer: string; placeholderFields: string[] }[] };

/**
 * The i-th pair goes to the i-th existing row (by order). Each of question and answer follows the
 * text rule; a pair with no row yet is created. Rows beyond the file's pairs are never touched.
 */
export function planFaqs(pairs: ParsedContent["faqs"], rows: readonly FaqRow[], overwrite: boolean): FaqPlan {
  const decisions: Decision[] = [];
  const writes: FaqPlan["writes"] = [];
  pairs.forEach((pair, index) => {
    const row = rows[index];
    const label = `faq ${index + 1}`;
    if (!row) {
      decisions.push({ name: `${label} (new row)`, status: "set" });
      writes.push({ index, id: null, question: pair.question, answer: pair.answer, placeholderFields: [] });
      return;
    }
    const q = decideText(`${label} question`, { value: row.question, flagged: row.placeholderFields.includes("question") }, pair.question, overwrite);
    const a = decideText(`${label} answer`, { value: row.answer, flagged: row.placeholderFields.includes("answer") }, pair.answer, overwrite);
    decisions.push(q, a);
    if (q.status === "set" || a.status === "set") {
      writes.push({
        index,
        id: row.id,
        question: q.status === "set" ? pair.question : row.question,
        answer: a.status === "set" ? pair.answer : row.answer,
        placeholderFields: row.placeholderFields.filter((f) => !(f === "question" && q.status === "set") && !(f === "answer" && a.status === "set")),
      });
    }
  });
  return { decisions, writes };
}

export type PageRow = Record<PageField, string | null> & { placeholderFields: string[]; coverMediaId: string | null; destinationId: string | null };

/** Page row: text fields, destination and hero photo. `data` holds only what will be written. */
export function planPage(
  page: PageRow,
  content: ParsedContent,
  links: { destinationId: string | null; destinationMissing?: string; heroId: string | null; heroMissing?: string },
  overwrite: boolean,
) {
  const decisions: Decision[] = [];
  const data: Record<string, string | string[]> = {};
  let flags = [...page.placeholderFields];
  for (const field of PAGE_FIELDS) {
    const d = decideText(field, { value: page[field], flagged: flags.includes(field) }, content.fields[field], overwrite);
    decisions.push(d);
    if (d.status === "set") {
      data[field] = content.fields[field];
      flags = flags.filter((f) => f !== field);
    }
  }
  const dest = decideLink("destination", page.destinationId, links.destinationId, links.destinationMissing ?? null, overwrite);
  const hero = decideLink("hero photo", page.coverMediaId, links.heroId, links.heroMissing ?? null, overwrite);
  decisions.push(dest, hero);
  if (dest.status === "set" && links.destinationId) data.destinationId = links.destinationId;
  if (hero.status === "set" && links.heroId) data.coverMediaId = links.heroId;
  if (Object.keys(data).length > 0) data.placeholderFields = flags;
  return { decisions, data, writtenFields: PAGE_FIELDS.filter((f) => f in data) };
}

export function summarize(decisions: readonly Decision[]) {
  return {
    set: decisions.filter((d) => d.status === "set").length,
    unchanged: decisions.filter((d) => d.status === "unchanged").length,
    skipped: decisions.filter((d) => d.status === "skipped").length,
  };
}
