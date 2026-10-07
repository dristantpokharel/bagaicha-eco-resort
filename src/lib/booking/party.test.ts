import { describe, expect, it } from "vitest";
import type { Capacity } from "./capacity";
import { capacityNote, childAgeRange, partyLimits, partySummary, stepParty } from "./party";

const family: Capacity = { maxGuests: 6, maxAdults: 6, maxChildren: null };
const deluxe: Capacity = { maxGuests: 3, maxAdults: 2, maxChildren: null };
const one = (cap: Capacity) => [{ cap, count: 1 }];

describe("guest steppers", () => {
  it("never goes below one adult or zero children", () => {
    expect(stepParty({ adults: 1, children: 0 }, "adults", -1, one(family))).toEqual({ adults: 1, children: 0 });
    expect(stepParty({ adults: 2, children: 0 }, "children", -1, one(family))).toEqual({ adults: 2, children: 0 });
    expect(partyLimits({ adults: 1, children: 0 }, one(family))).toMatchObject({ canRemoveAdult: false, canRemoveChild: false });
  });

  it("Family: + disabled for both once 6 guests are reached", () => {
    expect(partyLimits({ adults: 4, children: 2 }, one(family))).toMatchObject({ canAddAdult: false, canAddChild: false });
    expect(stepParty({ adults: 4, children: 2 }, "adults", 1, one(family))).toEqual({ adults: 4, children: 2 });
    expect(stepParty({ adults: 6, children: 0 }, "adults", 1, one(family))).toEqual({ adults: 6, children: 0 });
  });

  it("Deluxe: adults stop at 2 even with room left, children keep going until 3 guests", () => {
    expect(partyLimits({ adults: 2, children: 0 }, one(deluxe))).toMatchObject({ canAddAdult: false, canAddChild: true });
    expect(stepParty({ adults: 2, children: 0 }, "adults", 1, one(deluxe))).toEqual({ adults: 2, children: 0 });
    expect(stepParty({ adults: 2, children: 0 }, "children", 1, one(deluxe))).toEqual({ adults: 2, children: 1 });
    expect(partyLimits({ adults: 2, children: 1 }, one(deluxe))).toMatchObject({ canAddAdult: false, canAddChild: false });
    // 1 adult + 2 children is allowed; a third adult never is
    expect(stepParty({ adults: 1, children: 1 }, "children", 1, one(deluxe))).toEqual({ adults: 1, children: 2 });
    expect(partyLimits({ adults: 1, children: 2 }, one(deluxe)).canAddAdult).toBe(false);
  });

  it("honours maxChildren when set", () => {
    const cap: Capacity = { maxGuests: 5, maxAdults: 4, maxChildren: 1 };
    expect(stepParty({ adults: 2, children: 1 }, "children", 1, one(cap))).toEqual({ adults: 2, children: 1 });
    expect(partyLimits({ adults: 2, children: 1 }, one(cap))).toMatchObject({ canAddAdult: true, canAddChild: false });
  });

  it("Any room with one of each: a party can spread over both rooms", () => {
    const both = [{ cap: deluxe, count: 1 }, { cap: family, count: 1 }];
    expect(partyLimits({ adults: 6, children: 0 }, both).canAddAdult).toBe(true); // Family 6 + Deluxe 2 adults
    expect(partyLimits({ adults: 8, children: 0 }, both).canAddAdult).toBe(false);
    expect(partyLimits({ adults: 6, children: 2 }, both)).toMatchObject({ canAddAdult: true, canAddChild: true });
    expect(partyLimits({ adults: 8, children: 1 }, both)).toMatchObject({ canAddAdult: false, canAddChild: false });
  });

  it("is limited to the rooms that exist and to 4 rooms", () => {
    const two = [{ cap: deluxe, count: 2 }];
    expect(partyLimits({ adults: 4, children: 2 }, two)).toMatchObject({ canAddAdult: false, canAddChild: false });
    const many = [{ cap: deluxe, count: 9 }];
    expect(partyLimits({ adults: 8, children: 4 }, many)).toMatchObject({ canAddAdult: false, canAddChild: false }); // 4 rooms x 3
    expect(partyLimits({ adults: 8, children: 3 }, many).canAddChild).toBe(true);
  });

  it("summarises with correct plurals", () => {
    expect(partySummary({ adults: 2, children: 0 })).toBe("2 adults · 0 children");
    expect(partySummary({ adults: 1, children: 1 })).toBe("1 adult · 1 child");
  });
});

describe("capacity note", () => {
  it("is empty while both + buttons work", () => {
    expect(capacityNote({ adults: 1, children: 0 }, one(deluxe), "Deluxe Room")).toBeNull();
    expect(capacityNote({ adults: 2, children: 0 }, one(family))).toBeNull();
  });
  it("explains why + is disabled", () => {
    expect(capacityNote({ adults: 2, children: 0 }, one(deluxe), "Deluxe Room")).toBe("Deluxe Room takes up to 2 adults.");
    expect(capacityNote({ adults: 2, children: 1 }, one(deluxe), "Deluxe Room")).toBe("Deluxe Room sleeps up to 3 guests, children included.");
    const many = [{ cap: deluxe, count: 2 }, { cap: family, count: 1 }];
    expect(capacityNote({ adults: 10, children: 2 }, many)).toMatch(/most we can seat online.*enquiry/);
  });
});

describe("child age range label", () => {
  it("is derived from the setting", () => {
    expect(childAgeRange(13)).toBe("0–12");
    expect(childAgeRange(8)).toBe("0–7");
  });
});
