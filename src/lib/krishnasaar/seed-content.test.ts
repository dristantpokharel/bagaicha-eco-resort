import { describe, expect, it } from "vitest";
import { KRISHNASAAR_FAQS, KRISHNASAAR_FLAGGED, KRISHNASAAR_SEED } from "./seed-content";

const texts = [
  ...Object.entries(KRISHNASAAR_SEED).filter(([k]) => k !== "relatedGuides").map(([, v]) => String(v)),
  ...KRISHNASAAR_FAQS.flatMap((f) => [f.question, f.answer]),
];

describe("Krishnasaar starter text", () => {
  it("contains no numbers, so no unverified counts, areas, dates or distances", () => {
    for (const t of texts) expect(t, t).not.toMatch(/\d/);
  });
  it("flags every text field as verify", () => {
    const fields = Object.keys(KRISHNASAAR_SEED).filter((k) => k !== "relatedGuides");
    expect([...KRISHNASAAR_FLAGGED].sort()).toEqual(fields.sort());
  });
  it("keeps the page gate fields flagged, so it is hidden in production until reviewed", () => {
    for (const f of ["title", "intro", "whatItIs"]) expect(KRISHNASAAR_FLAGGED).toContain(f);
  });
});
