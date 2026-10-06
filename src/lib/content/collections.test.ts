import { describe, expect, it } from "vitest";
import { buildSchema, COLLECTIONS } from "./collections";

const parse = (key: keyof typeof COLLECTIONS, data: Record<string, string>) => buildSchema(COLLECTIONS[key]).safeParse(data);

describe("content schemas", () => {
  it("requires the title of an activity and turns blank optional fields into null", () => {
    expect(parse("activities", { title: "" }).success).toBe(false);
    const ok = parse("activities", { title: "Birdwatching", summary: "  ", duration: "" });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toMatchObject({ title: "Birdwatching", summary: null, duration: null, isActive: false });
  });

  it("reads the visibility checkbox", () => {
    const on = parse("faqs", { question: "Q?", answer: "A.", isActive: "on" });
    expect(on.success && on.data.isActive).toBe(true);
  });

  it("splits line lists and checks phone numbers and emails", () => {
    const ok = parse("business", { name: "X", phones: "+977 9747932458\n\n+977 9851081502", emails: "a@b.com" });
    expect(ok.success && ok.data.phones).toEqual(["+977 9747932458", "+977 9851081502"]);
    expect(parse("business", { name: "X", phones: "call me" }).success).toBe(false);
    expect(parse("business", { name: "X", emails: "nope" }).success).toBe(false);
  });

  it("only accepts web addresses for links", () => {
    expect(parse("business", { name: "X", instagramUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(parse("business", { name: "X", instagramUrl: "https://instagram.com/x" }).success).toBe(true);
  });

  it("keeps coordinates in range", () => {
    expect(parse("business", { name: "X", latitude: "91" }).success).toBe(false);
    const ok = parse("business", { name: "X", latitude: "28.229779", longitude: "81.332061" });
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
});
