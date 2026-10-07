import { describe, expect, it } from "vitest";
import { capacityErrors, describeCapacity, describeCapacityCompact, describeCapacityShort, fittingTypes, partyFits, partyProblem, type Capacity } from "./capacity";
import { validateStay } from "./rules";
import { computeQuote } from "./pricing";
import { roomTypeSchema } from "@/app/admin/rooms/schemas";

const deluxe: Capacity = { maxGuests: 3, maxAdults: 2, maxChildren: null };
const family: Capacity = { maxGuests: 6, maxAdults: 6, maxChildren: null };
const party = (adults: number, children: number) => ({ adults, children });

describe("partyFits", () => {
  it("Deluxe takes 2A+1C and 1A+2C", () => {
    expect(partyFits(deluxe, party(2, 1))).toBe(true);
    expect(partyFits(deluxe, party(1, 2))).toBe(true);
  });
  it("Deluxe refuses 3A, 2A+2C and 0A", () => {
    expect(partyFits(deluxe, party(3, 0))).toBe(false);
    expect(partyProblem(deluxe, party(3, 0))?.field).toBe("adults");
    expect(partyFits(deluxe, party(2, 2))).toBe(false);
    expect(partyProblem(deluxe, party(2, 2))?.message).toMatch(/sleeps up to 3/);
    expect(partyFits(deluxe, party(0, 2))).toBe(false);
  });
  it("Family takes 6A and refuses 7", () => {
    expect(partyFits(family, party(6, 0))).toBe(true);
    expect(partyFits(family, party(7, 0))).toBe(false);
    expect(partyFits(family, party(4, 3))).toBe(false);
  });
  it("applies maxChildren only when set", () => {
    const limited: Capacity = { maxGuests: 5, maxAdults: 4, maxChildren: 1 };
    expect(partyFits(limited, party(2, 1))).toBe(true);
    expect(partyFits(limited, party(2, 2))).toBe(false);
    expect(partyProblem(limited, party(2, 2))?.field).toBe("children");
    expect(partyFits(family, party(1, 5))).toBe(true);
  });
  it("fittingTypes is the one filter for a party", () => {
    expect(fittingTypes([deluxe, family], party(3, 0))).toEqual([family]);
    expect(fittingTypes([deluxe, family], party(1, 2))).toEqual([deluxe, family]);
  });
});

describe("submit validation uses the same rule", () => {
  const today = new Date("2026-10-06T00:00:00Z");
  const stay = (adults: number, children: number, capacity: Capacity) =>
    validateStay({ checkIn: "2026-11-10", checkOut: "2026-11-12", adults, children }, { today, publicRequest: true, capacity });
  it("accepts and refuses the same parties", () => {
    expect(stay(2, 1, deluxe).ok).toBe(true);
    expect(stay(1, 2, deluxe).ok).toBe(true);
    for (const [a, c] of [[3, 0], [2, 2]] as const) {
      const r = stay(a, c, deluxe);
      expect(r.ok).toBe(false);
    }
    expect(stay(0, 2, deluxe).ok).toBe(false);
    expect(stay(6, 0, family).ok).toBe(true);
    expect(stay(7, 0, family).ok).toBe(false);
  });
});

describe("labels", () => {
  it("describes the limits that restrict", () => {
    expect(describeCapacity(deluxe)).toBe("Up to 3 guests, max 2 adults");
    expect(describeCapacity(family)).toBe("Up to 6 guests");
    expect(describeCapacityShort(deluxe)).toBe("up to 3, max 2 adults");
    expect(describeCapacityShort(family)).toBe("up to 6");
    expect(describeCapacityCompact(family)).toBe("Up to 6 guests");
    expect(describeCapacityCompact(deluxe)).toBe("Up to 3 · max 2 adults");
    expect(describeCapacity({ maxGuests: 4, maxAdults: 2, maxChildren: 1 }, { childrenIncluded: true })).toBe(
      "Up to 4 guests, children included, max 2 adults, max 1 child",
    );
  });
});

describe("admin room type validation", () => {
  const base = { name: "Deluxe Room", description: "A comfortable room.", basePriceNpr: "3000", childPricePerNightNpr: "500", maxGuests: "3", maxAdults: "2", maxChildren: "" };
  it("accepts a valid occupancy and treats blank children as no limit", () => {
    const r = roomTypeSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.success && r.data.maxChildren).toBeNull();
  });
  it("requires maxAdults and refuses maxAdults above maxGuests", () => {
    expect(roomTypeSchema.safeParse({ ...base, maxAdults: "" }).success).toBe(false);
    const r = roomTypeSchema.safeParse({ ...base, maxAdults: "4" });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues.some((i) => i.path[0] === "maxAdults")).toBe(true);
  });
  it("refuses maxChildren above maxGuests", () => {
    const r = roomTypeSchema.safeParse({ ...base, maxChildren: "4" });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues.some((i) => i.path[0] === "maxChildren")).toBe(true);
    expect(roomTypeSchema.safeParse({ ...base, maxChildren: "2" }).success).toBe(true);
    expect(capacityErrors({ maxGuests: 3, maxAdults: 2, maxChildren: 4 }).maxChildren).toBeDefined();
  });
});

describe("pricing is unchanged by occupancy", () => {
  it("Deluxe 1 adult + 2 children for 1 night = 3,000 + 2 × 500", () => {
    const q = computeQuote({ nights: 1, pricePerNightNpr: 3000, childPricePerNightNpr: 500, children: 2 });
    expect(q.totalPriceNpr).toBe(4000);
  });
});
