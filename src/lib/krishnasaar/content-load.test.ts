import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertSafeTarget, parseOptions, writesEnabled } from "../../../scripts/krishnasaar-load";
import {
  DESTINATION_NAME,
  decideLink,
  decideText,
  PAGE_FIELDS,
  parseContent,
  planFaqs,
  planGallery,
  planPage,
  resolveMedia,
  type PageRow,
} from "./content-load";

const stagingUrl = "postgresql://user:secret@staging-db.neon.tech/resort";
const liveUrl = "postgresql://user:secret@live-prod.neon.tech/resort";

describe("krishnasaar:load options", () => {
  it("requires a target and an expected host", () => {
    expect(() => parseOptions(["--expect-host=x.neon.tech"])).toThrow("--target");
    expect(() => parseOptions(["--target=staging"])).toThrow("--expect-host");
    expect(() => parseOptions(["--target=prod", "--expect-host=x"])).toThrow("staging or live");
    expect(() => parseOptions(["--target=staging", "--expect-host=x", "--nope"])).toThrow("Unknown option");
  });

  it("is a dry run unless --apply is passed", () => {
    const dry = parseOptions(["--target=staging", "--expect-host=staging-db.neon.tech"]);
    const apply = parseOptions(["--target=staging", "--expect-host=staging-db.neon.tech", "--apply"]);
    expect(dry).toMatchObject({ apply: false, overwrite: false });
    expect(writesEnabled(dry)).toBe(false);
    expect(apply.apply).toBe(true);
    expect(writesEnabled(apply)).toBe(true);
    expect(parseOptions(["--target=live", "--expect-host=h", "--overwrite"]).overwrite).toBe(true);
  });

  it("rejects repeated flags", () => {
    expect(() => parseOptions(["--target=staging", "--target=live", "--expect-host=h"])).toThrow("only be specified once");
    expect(() => parseOptions(["--target=staging", "--expect-host=h", "--apply", "--apply"])).toThrow("only be specified once");
  });
});

describe("krishnasaar:load host guard", () => {
  it("staging uses DIRECT_URL and live uses DIRECT_URL_LIVE", () => {
    expect(assertSafeTarget({ target: "staging", directUrl: stagingUrl, liveUrl, expectHost: "staging-db.neon.tech" }).url).toBe(stagingUrl);
    expect(assertSafeTarget({ target: "live", directUrl: stagingUrl, liveUrl, expectHost: "live-prod.neon.tech" }).url).toBe(liveUrl);
  });

  it("refuses when the target's URL is missing", () => {
    expect(() => assertSafeTarget({ target: "live", directUrl: stagingUrl, expectHost: "live-prod.neon.tech" })).toThrow("DIRECT_URL_LIVE is required");
    expect(() => assertSafeTarget({ target: "staging", liveUrl, expectHost: "x" })).toThrow("DIRECT_URL is required");
  });

  it("refuses when --expect-host does not match the connected host (any case, trailing dot allowed)", () => {
    expect(() => assertSafeTarget({ target: "staging", directUrl: stagingUrl, expectHost: "other.neon.tech" })).toThrow("does not match");
    expect(assertSafeTarget({ target: "staging", directUrl: stagingUrl, expectHost: "STAGING-DB.neon.tech." }).host).toBe("staging-db.neon.tech");
  });

  it("refuses when the target's host equals the other target's host", () => {
    expect(() => assertSafeTarget({ target: "staging", directUrl: liveUrl, liveUrl, expectHost: "live-prod.neon.tech" })).toThrow("same host as DIRECT_URL_LIVE");
    expect(() => assertSafeTarget({ target: "live", directUrl: liveUrl, liveUrl, expectHost: "live-prod.neon.tech" })).toThrow("same host as DIRECT_URL");
    expect(() =>
      assertSafeTarget({ target: "live", directUrl: stagingUrl, databaseUrl: liveUrl, liveUrl, expectHost: "live-prod.neon.tech" }),
    ).toThrow("same host as DATABASE_URL");
  });

  it("never puts a connection string or password in an error", () => {
    for (const run of [
      () => assertSafeTarget({ target: "staging", directUrl: stagingUrl, expectHost: "other.neon.tech" }),
      () => assertSafeTarget({ target: "staging", directUrl: liveUrl, liveUrl, expectHost: "live-prod.neon.tech" }),
      () => assertSafeTarget({ target: "staging", directUrl: "not a url", expectHost: "x" }),
    ]) {
      try {
        run();
      } catch (error) {
        expect(String((error as Error).message)).not.toMatch(/secret|postgresql:\/\//);
      }
    }
  });
});

const file = readFileSync(resolve(process.cwd(), "docs/krishnasaar-content.md"), "utf8");

describe("parseContent (the real content file)", () => {
  const parsed = parseContent(file);

  it("maps every section to its field, in the file's own words", () => {
    expect(parsed.fields.title).toBe("Krishnasaar (Blackbuck) Conservation Area");
    expect(parsed.fields.intro).toMatch(/^Nepal's only wild herd of blackbuck/);
    expect(parsed.fields.whatItIs).toMatch(/^The Krishnasaar Conservation Area, also called/);
    expect(parsed.fields.history).toMatch(/^By the early 1970s/);
    expect(parsed.fields.wildlife).toMatch(/^Adult males are dark brown/);
    expect(parsed.fields.bestTime).toMatch(/^October to April is the best time/);
    expect(parsed.fields.gettingThere).toMatch(/^The conservation area is just 10 minutes/);
    expect(PAGE_FIELDS).toHaveLength(8);
  });

  it("keeps blank-line paragraph breaks and the exact figures", () => {
    expect(parsed.fields.whatItIs.split("\n\n")).toHaveLength(3);
    expect(parsed.fields.history.split("\n\n")).toHaveLength(3);
    expect(parsed.fields.whatItIs).toContain("16.95 sq km");
    expect(parsed.fields.history).toContain("a herd of just nine animals");
  });

  it("stores the what-to-bring list one item per line, like a textarea, and stops before Settings", () => {
    const lines = parsed.fields.whatToBring.split("\n");
    expect(lines[0]).toBe("Binoculars and a camera with a zoom lens");
    expect(lines).toHaveLength(6);
    expect(lines.at(-1)).toMatch(/^Cash in rupees/);
    expect(parsed.fields.whatToBring).not.toContain("Settings");
    expect(parsed.fields.whatToBring).not.toContain("\n\n");
  });

  it("reads the settings", () => {
    expect(parsed.destinationName).toBe(DESTINATION_NAME);
    expect(parsed.heroFilename).toBe("explore-krishnasaar.jpg");
    expect(parsed.galleryFilenames).toEqual(["explore-krishnasaar.jpg", "explore-birdwatching.jpg", "explore-mustard-plan-vertical.jpeg"]);
  });

  it("reads the five question and answer pairs in order", () => {
    expect(parsed.faqs.map((f) => f.question)).toEqual([
      "What is the best time to visit?",
      "How do I get there from the resort?",
      "Do I need a guide or a permit?",
      "What should I bring?",
      "Can children visit?",
    ]);
    expect(parsed.faqs[2].answer).toContain("Rs 2,000 for foreigners");
    expect(parsed.faqs.every((f) => f.answer && !f.answer.includes("\n"))).toBe(true);
  });

  it("handles Windows line endings", () => {
    expect(parseContent(file.replace(/\n/g, "\r\n")).fields).toEqual(parsed.fields);
  });

  it("refuses a file with a missing section or the wrong number of pairs", () => {
    expect(() => parseContent(file.replace("\nHistory and conservation\n", "\n"))).toThrow("History and conservation");
    expect(() => parseContent(file.replace(/Can children visit\?\n[^\n]*/, ""))).toThrow("Expected 5");
  });
});

const page = (over: Partial<PageRow> = {}): PageRow => ({
  title: "Krishnasaar", intro: "starter", whatItIs: "starter", history: "starter", wildlife: "starter",
  bestTime: "starter", gettingThere: "starter", whatToBring: "starter",
  coverMediaId: null, destinationId: null,
  placeholderFields: [...PAGE_FIELDS],
  ...over,
});
const content = parseContent(file);
const links = { destinationId: "dest1", heroId: "m1" };

describe("planPage", () => {
  it("replaces flagged starter text and clears every flag it writes", () => {
    const plan = planPage(page(), content, links, false);
    expect(plan.decisions.filter((d) => PAGE_FIELDS.includes(d.name as never)).every((d) => d.status === "set")).toBe(true);
    expect(plan.data.title).toBe(content.fields.title);
    expect(plan.data.placeholderFields).toEqual([]);
    expect(plan.data.destinationId).toBe("dest1");
    expect(plan.data.coverMediaId).toBe("m1");
    expect(plan.writtenFields).toEqual(PAGE_FIELDS);
  });

  it("skips a field a person already edited and keeps its (cleared) flag state", () => {
    const plan = planPage(page({ intro: "The owner's own wording", placeholderFields: PAGE_FIELDS.filter((f) => f !== "intro") }), content, links, false);
    expect(plan.decisions.find((d) => d.name === "intro")).toMatchObject({ status: "skipped" });
    expect("intro" in plan.data).toBe(false);
    expect(plan.data.placeholderFields).toEqual([]);
  });

  it("replaces an edited field only with --overwrite", () => {
    const edited = page({ intro: "The owner's own wording", placeholderFields: [] });
    expect(planPage(edited, content, links, true).data.intro).toBe(content.fields.intro);
    expect("intro" in planPage(edited, content, links, false).data).toBe(false);
  });

  it("changes nothing when everything already matches", () => {
    const done = page({ ...content.fields, coverMediaId: "m1", destinationId: "dest1", placeholderFields: [] });
    const plan = planPage(done, content, links, false);
    expect(plan.decisions.every((d) => d.status === "unchanged")).toBe(true);
    expect(plan.data).toEqual({});
  });

  it("clears the flag when the flagged text already matches", () => {
    expect(decideText("x", { value: "same", flagged: true }, "same", false)).toMatchObject({ status: "set" });
    expect(decideText("x", { value: "same", flagged: false }, "same", false)).toMatchObject({ status: "unchanged" });
  });

  it("leaves unrelated flags alone", () => {
    const plan = planPage(page({ placeholderFields: [...PAGE_FIELDS, "somethingElse"] }), content, links, false);
    expect(plan.data.placeholderFields).toEqual(["somethingElse"]);
  });

  it("skips and reports a hero photo that was not found, and still loads the text", () => {
    const plan = planPage(page(), content, { destinationId: "dest1", heroId: null, heroMissing: "not found in this database's media library" }, false);
    expect(plan.decisions.find((d) => d.name === "hero photo")).toMatchObject({ status: "skipped", reason: expect.stringContaining("not found") });
    expect("coverMediaId" in plan.data).toBe(false);
    expect(plan.data.title).toBeDefined();
  });

  it("does not replace a different existing link without --overwrite", () => {
    expect(decideLink("hero photo", "other", "m1", null, false).status).toBe("skipped");
    expect(decideLink("hero photo", "other", "m1", null, true).status).toBe("set");
    expect(decideLink("hero photo", "m1", "m1", null, false).status).toBe("unchanged");
  });
});

describe("planFaqs", () => {
  const rows = [1, 2, 3, 4, 5].map((n) => ({ id: `f${n}`, question: `Q${n}`, answer: `A${n}`, placeholderFields: ["question", "answer"] }));

  it("maps the five pairs to the five starter rows in order and clears both flags", () => {
    const plan = planFaqs(content.faqs, rows, false);
    expect(plan.writes.map((w) => w.id)).toEqual(["f1", "f2", "f3", "f4", "f5"]);
    expect(plan.writes[0]).toMatchObject({ question: content.faqs[0].question, answer: content.faqs[0].answer, placeholderFields: [] });
  });

  it("skips an edited question or answer but still writes the other", () => {
    const edited = rows.map((r, i) => (i === 0 ? { ...r, answer: "Owner wording", placeholderFields: ["question"] } : r));
    const plan = planFaqs(content.faqs, edited, false);
    expect(plan.decisions.find((d) => d.name === "faq 1 answer")?.status).toBe("skipped");
    expect(plan.writes[0]).toMatchObject({ question: content.faqs[0].question, answer: "Owner wording", placeholderFields: [] });
  });

  it("creates rows that are missing and never touches extra rows", () => {
    const plan = planFaqs(content.faqs, [...rows.slice(0, 3), { id: "extra", question: "x", answer: "y", placeholderFields: [] }].slice(0, 3), false);
    expect(plan.writes.filter((w) => w.id === null).map((w) => w.index)).toEqual([3, 4]);
    expect(planFaqs(content.faqs, [...rows, { id: "sixth", question: "x", answer: "y", placeholderFields: [] }], false).writes.some((w) => w.id === "sixth")).toBe(false);
  });
});

describe("media and gallery", () => {
  const library = [
    { id: "m1", originalFilename: "explore-krishnasaar.jpg" },
    { id: "m2", originalFilename: "explore-birdwatching.jpg" },
  ];
  const names = content.galleryFilenames;

  it("matches by original filename and lists the ones it cannot find", () => {
    const media = resolveMedia(["explore-krishnasaar.jpg", ...names], library);
    expect(media.found.get("explore-krishnasaar.jpg")).toBe("m1");
    expect(media.problems).toEqual([{ filename: "explore-mustard-plan-vertical.jpeg", reason: expect.stringContaining("not found") }]);
  });

  it("treats a filename shared by several rows as ambiguous and skips it", () => {
    const media = resolveMedia(["a.jpg"], [{ id: "1", originalFilename: "a.jpg" }, { id: "2", originalFilename: "a.jpg" }]);
    expect(media.found.size).toBe(0);
    expect(media.problems[0].reason).toContain("2 media rows");
  });

  it("adds found photos after the existing ones, skips missing ones, and is repeatable", () => {
    const media = resolveMedia(names, library);
    const first = planGallery(names, media.found, []);
    expect(first.add).toEqual(["m1", "m2"]);
    expect(first.decisions.map((d) => d.status)).toEqual(["set", "set", "skipped"]);
    const again = planGallery(names, media.found, ["m1", "m2"]);
    expect(again.add).toEqual([]);
    expect(again.decisions.map((d) => d.status)).toEqual(["unchanged", "unchanged", "skipped"]);
  });
});
