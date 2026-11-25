import { describe, expect, it } from "vitest";
import { buildSchema, COLLECTIONS } from "./collections";

const parse = (key: keyof typeof COLLECTIONS, data: Record<string, string>) => buildSchema(COLLECTIONS[key]).safeParse(data);

describe("content schemas", () => {
  it("requires the title of an activity and turns blank optional fields into null", () => {
    expect(parse("activities", { title: "", group: "AT_BAGAICHA" }).success).toBe(false);
    const ok = parse("activities", { title: "Birdwatching", group: "AT_BAGAICHA", overview: "  ", category: "" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toMatchObject({ title: "Birdwatching", overview: null, category: null, isActive: false });
  });

  it("reads the visibility checkbox", () => {
    const on = parse("faqs", { question: "Q?", answer: "A.", isActive: "on" });
    expect(on.success && on.data.isActive).toBe(true);
  });

  it("splits line lists and checks phone numbers and emails", () => {
    const ok = parse("business", { name: "X", childUnderAge: "8", phones: "+977 9747932458\n\n+977 9851081502", emails: "a@b.com" });
    expect(ok.success && ok.data.phones).toEqual(["+977 9747932458", "+977 9851081502"]);
    expect(parse("business", { name: "X", childUnderAge: "8", phones: "call me" }).success).toBe(false);
    expect(parse("business", { name: "X", childUnderAge: "8", emails: "nope" }).success).toBe(false);
  });

  it("only accepts web addresses for links", () => {
    expect(parse("business", { name: "X", childUnderAge: "8", instagramUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(parse("business", { name: "X", childUnderAge: "8", instagramUrl: "https://instagram.com/x" }).success).toBe(true);
  });

  it("keeps coordinates in range", () => {
    expect(parse("business", { name: "X", childUnderAge: "8", latitude: "91" }).success).toBe(false);
    const ok = parse("business", { name: "X", childUnderAge: "8", latitude: "28.229779", longitude: "81.332061" });
    expect(ok.success && ok.data.latitude).toBeCloseTo(28.229779);
  });

  it("limits nearby icons to the icon set", () => {
    expect(parse("nearby", { name: "Nepalgunj", icon: "rocket" }).success).toBe(false);
    expect(parse("nearby", { name: "Nepalgunj", icon: "plane" }).success).toBe(true);
  });

  it("accepts whole-rupee dining prices with commas and rejects negatives", () => {
    const ok = parse("diningItems", { sectionId: "s1", name: "Thali", priceNpr: "1,200" });
    expect(ok.success && ok.data.priceNpr).toBe(1200);
    expect(parse("diningItems", { sectionId: "s1", name: "Thali", priceNpr: "-5" }).success).toBe(false);
  });

  it("activities need a group, link a destination and only keep the simplified fields", () => {
    expect(parse("activities", { title: "Jeep safari", group: "SPACE" }).success).toBe(false);
    expect(parse("activities", { title: "Jeep safari" }).success).toBe(false);
    const ok = parse("activities", {
      title: "Jeep safari",
      group: "DAY_TRIP",
      overview: "A day in the park.",
      destinationId: "abc123",
      duration: "All day",
      bestFor: "Families",
      tip: "Bring a hat",
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data).toMatchObject({ group: "DAY_TRIP", overview: "A day in the park.", destinationId: "abc123" });
      for (const gone of ["summary", "duration", "season", "bestTime", "bestFor", "highlights", "whatToExpect", "howWeHelp", "tip"])
        expect(ok.data).not.toHaveProperty(gone);
    }
  });

  it("allows an activity with no linked destination", () => {
    const ok = parse("activities", { title: "Pickleball", group: "AT_BAGAICHA", destinationId: "" });
    expect(ok.success && ok.data.destinationId).toBeNull();
  });

  it("validates homepage selection and order for activities", () => {
    const selected = parse("activities", {
      title: "Birdwatching",
      group: "DAY_TRIP",
      showOnHomepage: "on",
      homepageOrder: "3",
    });
    expect(selected.success && selected.data).toMatchObject({ showOnHomepage: true, homepageOrder: 3 });

    const unchecked = parse("activities", { title: "Walk", group: "AT_BAGAICHA", homepageOrder: "0" });
    expect(unchecked.success && unchecked.data.showOnHomepage).toBe(false);
    expect(parse("activities", { title: "Walk", group: "AT_BAGAICHA", homepageOrder: "1000" }).success).toBe(false);
    expect(parse("activities", { title: "Walk", group: "AT_BAGAICHA", homepageOrder: "1.5" }).success).toBe(false);
  });
});

describe("Krishnasaar schemas", () => {
  it("is a single-row collection whose page-gate fields are required live", () => {
    expect(COLLECTIONS.krishnasaar.singleton).toBe(true);
    expect(COLLECTIONS.krishnasaar.requiredLive).toEqual(["title", "intro", "whatItIs"]);
  });

  it("requires a title, turns blank sections into null and splits related guide slugs", () => {
    expect(parse("krishnasaar", { title: "" }).success).toBe(false);
    const ok = parse("krishnasaar", { title: "Krishnasaar", history: " ", destinationId: "", relatedGuides: "one\n\ntwo" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toMatchObject({ title: "Krishnasaar", history: null, destinationId: null, relatedGuides: ["one", "two"] });
  });

  it("requires a question and an answer for each Krishnasaar FAQ", () => {
    expect(parse("krishnasaarFaqs", { question: "Q?", answer: "" }).success).toBe(false);
    expect(parse("krishnasaarFaqs", { question: "Q?", answer: "A." }).success).toBe(true);
  });
});

