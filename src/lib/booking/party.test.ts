import { describe, expect, it } from "vitest";
import { partyLimits, partySummary, stepParty } from "./party";

describe("guest steppers", () => {
  it("never goes below one adult or zero children", () => {
    expect(stepParty({ adults: 1, children: 0 }, "adults", -1, 6)).toEqual({ adults: 1, children: 0 });
    expect(stepParty({ adults: 2, children: 0 }, "children", -1, 6)).toEqual({ adults: 2, children: 0 });
    expect(partyLimits({ adults: 1, children: 0 }, 6)).toMatchObject({ canRemoveAdult: false, canRemoveChild: false });
  });

  it("disables + for both fields once adults + children fill the largest room", () => {
    const limits = partyLimits({ adults: 4, children: 2 }, 6);
    expect(limits).toMatchObject({ canAddAdult: false, canAddChild: false, canRemoveAdult: true, canRemoveChild: true });
    expect(stepParty({ adults: 4, children: 2 }, "adults", 1, 6)).toEqual({ adults: 4, children: 2 });
    expect(stepParty({ adults: 4, children: 2 }, "children", 1, 6)).toEqual({ adults: 4, children: 2 });
  });

  it("allows + while there is room and frees it again after −", () => {
    expect(stepParty({ adults: 2, children: 0 }, "children", 1, 6)).toEqual({ adults: 2, children: 1 });
    const full = { adults: 3, children: 3 };
    expect(partyLimits(stepParty(full, "children", -1, 6), 6).canAddAdult).toBe(true);
  });

  it("respects a one-guest maximum", () => {
    expect(partyLimits({ adults: 1, children: 0 }, 1)).toMatchObject({ canAddAdult: false, canAddChild: false });
  });

  it("summarises with correct plurals", () => {
    expect(partySummary({ adults: 2, children: 0 })).toBe("2 adults · 0 children");
    expect(partySummary({ adults: 1, children: 1 })).toBe("1 adult · 1 child");
  });
});
