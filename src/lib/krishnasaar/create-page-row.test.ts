import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { parseOptions, runLoad, type LoadOptions } from "../../../scripts/krishnasaar-load";
import { parseContent } from "./content-load";
import { KRISHNASAAR_FLAGGED } from "./seed-content";
import { faqRowsData, pageRowData } from "./seed-rows";

const markdown = readFileSync(resolve(process.cwd(), "docs/krishnasaar-content.md"), "utf8");
const content = parseContent(markdown);

type Row = Record<string, unknown>;
type State = { page: Row | null; faqs: Row[]; gallery: Row[]; logs: Row[]; pageCreates: number; faqCreates: number };

/** An in-memory stand-in for the database; $transaction restores a snapshot when the callback throws. */
function fakeDb(initial: Partial<State> = {}, opts: { failLog?: boolean } = {}) {
  const state: State = { page: null, faqs: [], gallery: [], logs: [], pageCreates: 0, faqCreates: 0, ...initial };
  const tx = {
    $queryRawUnsafe: async () => [{ found: "table" }],
    krishnasaarPage: {
      findUnique: async () => (state.page ? { ...state.page } : null),
      create: async ({ data }: { data: Row }) => {
        state.pageCreates++;
        state.page = { coverMediaId: null, destinationId: null, ...data };
        return state.page;
      },
      update: async ({ data }: { data: Row }) => {
        state.page = { ...state.page, ...data };
        return state.page;
      },
    },
    krishnasaarFaq: {
      count: async () => state.faqs.length,
      findMany: async () => state.faqs.map((f) => ({ ...f })),
      create: async ({ data }: { data: Row }) => {
        state.faqCreates++;
        state.faqs.push({ id: `faq-${state.faqs.length}`, ...data });
        return data;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const i = state.faqs.findIndex((f) => f.id === where.id);
        state.faqs[i] = { ...state.faqs[i], ...data };
        return state.faqs[i];
      },
    },
    nearbyDestination: { findMany: async () => [{ id: "dest1" }] },
    media: {
      findMany: async () => [
        { id: "m1", originalFilename: "explore-krishnasaar.jpg" },
        { id: "m2", originalFilename: "explore-birdwatching.jpg" },
        { id: "m3", originalFilename: "explore-mustard-plan-vertical.jpeg" },
      ],
    },
    krishnasaarMedia: {
      findMany: async () => state.gallery.map((g) => ({ ...g })),
      create: async ({ data }: { data: Row }) => void state.gallery.push(data),
    },
    activityLog: {
      create: async ({ data }: { data: Row }) => {
        if (opts.failLog) throw new Error("log write failed");
        state.logs.push(data);
      },
    },
  };
  const client = {
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
      const snapshot = structuredClone(state);
      try {
        return await fn(tx);
      } catch (error) {
        Object.assign(state, snapshot);
        throw error;
      }
    },
  } as unknown as Pick<PrismaClient, "$transaction">;
  return { state, client };
}

const options = (over: Partial<LoadOptions> = {}): LoadOptions => ({
  target: "staging",
  expectHost: "staging-db.neon.tech",
  apply: false,
  overwrite: false,
  createPageRow: true,
  ...over,
});

let logged: string[];
beforeEach(() => {
  logged = [];
  vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => void logged.push(args.join(" ")));
});
afterEach(() => vi.restoreAllMocks());

describe("--create-page-row options", () => {
  it("is off by default and on with the flag", () => {
    expect(parseOptions(["--target=staging", "--expect-host=h"]).createPageRow).toBe(false);
    expect(parseOptions(["--target=staging", "--expect-host=h", "--create-page-row"]).createPageRow).toBe(true);
  });

  it("is refused without --target and a matching --expect-host (the same checks as every run)", () => {
    expect(() => parseOptions(["--create-page-row", "--expect-host=h"])).toThrow("--target");
    expect(() => parseOptions(["--target=staging", "--create-page-row"])).toThrow("--expect-host");
    expect(() => parseOptions(["--target=staging", "--expect-host=h", "--create-page-row", "--create-page-row"])).toThrow("only be specified once");
  });
});

describe("--create-page-row dry run", () => {
  it("creates nothing, says it would, and plans field by field as if the row existed", async () => {
    const { state, client } = fakeDb();
    await runLoad(client, options(), "staging-db.neon.tech", markdown);
    expect(state.page).toBeNull();
    expect(state.faqs).toHaveLength(0);
    expect(state.pageCreates + state.faqCreates).toBe(0);
    expect(state.logs).toHaveLength(0);
    expect(logged).toContain("would create page row");
    expect(logged.join("\n")).toContain("would create question rows");
    expect(logged.join("\n")).toContain("title: would set");
    expect(logged.join("\n")).toContain("faq 1 question: would set");
    expect(logged.join("\n")).toContain("Mode: DRY RUN");
  });

  it("without --apply writes nothing even when a row already exists", async () => {
    const { state, client } = fakeDb({ page: { ...pageRowData(), coverMediaId: null, destinationId: null } });
    await runLoad(client, options(), "h", markdown);
    expect(state.page?.title).toBe("Krishnasaar");
    expect(state.pageCreates).toBe(0);
  });
});

describe("--create-page-row with --apply", () => {
  it("creates the starter rows like the seed, then loads the content in the same run", async () => {
    const { state, client } = fakeDb();
    await runLoad(client, options({ apply: true }), "h", markdown);
    expect(state.pageCreates).toBe(1);
    expect(state.faqCreates).toBe(5);
    expect(state.page).toMatchObject({ id: 1, title: content.fields.title, intro: content.fields.intro, placeholderFields: [], destinationId: "dest1", coverMediaId: "m1" });
    expect(state.page?.relatedGuides).toEqual(pageRowData().relatedGuides);
    expect(state.faqs.map((f) => f.question)).toEqual(content.faqs.map((f) => f.question));
    expect(state.faqs.every((f) => (f.placeholderFields as string[]).length === 0)).toBe(true);
    expect(state.gallery).toHaveLength(3);
    expect(state.logs).toHaveLength(1);
    expect(JSON.stringify(state.logs[0])).not.toContain("blackbuck");
    expect(JSON.stringify(state.logs[0])).toContain("createPageRow");
  });

  it("never modifies an existing row: nothing is created, an edited field and other columns survive", async () => {
    const edited = { ...pageRowData(), intro: "Owner's own intro", relatedGuides: ["keep-me"], placeholderFields: KRISHNASAAR_FLAGGED.filter((f) => f !== "intro"), coverMediaId: null, destinationId: null };
    const faqs = faqRowsData().map((f, i) => ({ id: `old-${i}`, ...f }));
    const { state, client } = fakeDb({ page: edited, faqs });
    await runLoad(client, options({ apply: true }), "h", markdown);
    expect(state.pageCreates).toBe(0);
    expect(state.faqCreates).toBe(0);
    expect(state.page?.intro).toBe("Owner's own intro");
    expect(state.page?.relatedGuides).toEqual(["keep-me"]);
    expect(state.faqs.map((f) => f.id)).toEqual(["old-0", "old-1", "old-2", "old-3", "old-4"]);
    expect(logged.join("\n")).toContain("Page row: already exists, left untouched.");
  });

  it("rolls everything back, including the new page row and questions, if any step fails", async () => {
    const { state, client } = fakeDb({}, { failLog: true });
    await expect(runLoad(client, options({ apply: true }), "h", markdown)).rejects.toThrow("log write failed");
    expect(state.page).toBeNull();
    expect(state.faqs).toHaveLength(0);
    expect(state.gallery).toHaveLength(0);
    expect(state.logs).toHaveLength(0);
  });
});

describe("without --create-page-row", () => {
  it("still refuses when the page row is missing, and points at both ways to fix it", async () => {
    const { state, client } = fakeDb();
    await expect(runLoad(client, options({ apply: true, createPageRow: false }), "h", markdown)).rejects.toThrow(/seed:krishnasaar.*--create-page-row/);
    expect(state.pageCreates).toBe(0);
  });
});

describe("shared seed rows", () => {
  it("makes the same starter row the seed script makes: id 1, every text field flagged", () => {
    expect(pageRowData().id).toBe(1);
    expect(pageRowData().placeholderFields).toEqual([...KRISHNASAAR_FLAGGED]);
    const faqs = faqRowsData();
    expect(faqs).toHaveLength(5);
    expect(faqs.map((f) => f.sortOrder)).toEqual([0, 1, 2, 3, 4]);
    expect(faqs.every((f) => f.placeholderFields.join() === "question,answer")).toBe(true);
  });
});
