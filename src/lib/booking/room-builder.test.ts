import { describe, expect, it } from "vitest";
import {
  calculationLines,
  checkRooms,
  childAgeRange,
  fitReason,
  guestLimits,
  guestNote,
  guestsSummary,
  largestCapacity,
  quoteRooms,
  startingParty,
  stepGuests,
  typeOption,
  type BuilderRoom,
  type BuilderType,
} from "./room-builder";

const type = (slug: string, maxGuests: number, maxAdults: number, price: number, maxChildren: number | null = null): BuilderType => ({
  slug,
  name: slug.toUpperCase(),
  maxGuests,
  maxAdults,
  maxChildren,
  basePriceNpr: price,
  childPricePerNightNpr: 500,
});
const deluxe = type("dlx", 3, 2, 3000);
const family = type("fam", 6, 6, 4500);
const types = new Map([deluxe, family].map((t) => [t.slug, t]));
const room = (slug: string | null, adults = 2, children = 0): BuilderRoom => ({ slug, adults, children });
const free = (dlx: number, fam: number) => new Map([["dlx", dlx], ["fam", fam]]);

describe("why a type is disabled", () => {
  it("says what the room fits", () => {
    expect(fitReason(deluxe, { adults: 2, children: 2 })).toBe("Fits up to 3");
    expect(fitReason(deluxe, { adults: 3, children: 0 })).toBe("Max 2 adults");
    expect(fitReason(type("x", 5, 4, 1000, 1), { adults: 2, children: 2 })).toBe("Max 1 child");
    expect(fitReason(family, { adults: 4, children: 2 })).toBeNull();
  });
});

describe("type buttons", () => {
  it("show no count before the dates are set, and only disable on fit", () => {
    expect(typeOption([room(null, 2, 2)], 0, deluxe, null)).toEqual({ left: null, disabled: true, reason: "Fits up to 3" });
    expect(typeOption([room(null, 2, 1)], 0, deluxe, null)).toEqual({ left: null, disabled: false, reason: null });
  });
  it("show the rooms left once dates are set", () => {
    expect(typeOption([room(null)], 0, deluxe, free(2, 1))).toEqual({ left: 2, disabled: false, reason: null });
  });
  it("are disabled with a reason when sold out for the stay", () => {
    expect(typeOption([room(null)], 0, deluxe, free(0, 1))).toEqual({ left: 0, disabled: true, reason: "Sold out" });
  });
  it("share availability: a Deluxe in Room 1 leaves one fewer for Room 2", () => {
    const rooms = [room("dlx"), room(null)];
    expect(typeOption(rooms, 1, deluxe, free(2, 1)).left).toBe(1);
    expect(typeOption(rooms, 0, deluxe, free(2, 1)).left).toBe(2); // Room 1 doesn't count against itself
  });
  it("run out when the other rooms hold every free room", () => {
    const rooms = [room("dlx"), room(null)];
    expect(typeOption(rooms, 1, deluxe, free(1, 1))).toEqual({ left: 0, disabled: true, reason: "None left" });
  });
});

describe("guest steppers", () => {
  it("never go below one adult or zero children", () => {
    expect(stepGuests({ adults: 1, children: 0 }, "adults", -1, [family])).toEqual({ adults: 1, children: 0 });
    expect(guestLimits({ adults: 1, children: 0 }, [family])).toMatchObject({ canRemoveAdult: false, canRemoveChild: false });
  });
  it("follow the chosen type: Deluxe adults stop at 2, children until 3 guests", () => {
    expect(guestLimits({ adults: 2, children: 0 }, [deluxe])).toMatchObject({ canAddAdult: false, canAddChild: true });
    expect(guestLimits({ adults: 2, children: 1 }, [deluxe])).toMatchObject({ canAddAdult: false, canAddChild: false });
    expect(stepGuests({ adults: 2, children: 1 }, "children", 1, [deluxe])).toEqual({ adults: 2, children: 1 });
    expect(stepGuests({ adults: 1, children: 1 }, "children", 1, [deluxe])).toEqual({ adults: 1, children: 2 });
  });
  it("honour maxChildren", () => {
    expect(guestLimits({ adults: 2, children: 1 }, [type("x", 5, 4, 1000, 1)])).toMatchObject({ canAddAdult: true, canAddChild: false });
  });
  it("with no type chosen, go as far as the largest room allows", () => {
    expect(guestLimits({ adults: 5, children: 0 }, [deluxe, family]).canAddAdult).toBe(true);
    expect(guestLimits({ adults: 6, children: 0 }, [deluxe, family]).canAddAdult).toBe(false);
  });
  it("explain a disabled +", () => {
    expect(guestNote({ adults: 2, children: 0 }, [deluxe], "Deluxe Room")).toBe("Deluxe Room takes up to 2 adults.");
    expect(guestNote({ adults: 2, children: 1 }, [deluxe], "Deluxe Room")).toBe("Deluxe Room sleeps up to 3 guests, children included.");
    expect(guestNote({ adults: 2, children: 0 }, [family])).toBeNull();
    expect(guestNote({ adults: 6, children: 0 }, [deluxe, family])).toMatch(/largest room/);
  });
  it("summarise with correct plurals and age range", () => {
    expect(guestsSummary({ adults: 2, children: 0 })).toBe("2 adults · 0 children");
    expect(guestsSummary({ adults: 1, children: 1 })).toBe("1 adult · 1 child");
    expect(childAgeRange(13)).toBe("0–12");
  });
  it("start Room 1 with 2 adults, fewer in a smaller room", () => {
    expect(startingParty(deluxe)).toEqual({ adults: 2, children: 0 });
    expect(startingParty(type("single", 1, 1, 1000))).toEqual({ adults: 1, children: 0 });
  });
});

describe("checking the rooms", () => {
  it("passes when every room has a fitting type and enough free rooms", () => {
    expect(checkRooms([room("dlx"), room("fam", 4, 2)], types, free(1, 1)).ok).toBe(true);
  });
  it("asks for a type in a room that has none", () => {
    const r = checkRooms([room("dlx"), room(null)], types, free(2, 1));
    expect(r.ok).toBe(false);
    expect(r.problems).toEqual([null, "Room 2: choose a room type."]);
  });
  it("names the room whose guests don't fit", () => {
    const r = checkRooms([room("dlx", 3)], types, free(2, 1));
    expect(r.problems[0]).toBe("Room 1 (DLX): This room takes up to 2 adults.");
  });
  it("refuses more rooms of a type than are free, and sold-out types", () => {
    expect(checkRooms([room("dlx"), room("dlx")], types, free(1, 1)).problems).toEqual([null, "Room 2: no more DLX rooms are free for these dates."]);
    expect(checkRooms([room("dlx")], types, free(0, 1)).problems).toEqual(["Room 1: DLX is sold out for these dates."]);
  });
  it("skips the free-room check while the dates aren't ready (the form asks for dates separately)", () => {
    expect(checkRooms([room("dlx")], types, null).ok).toBe(true);
  });
  it("allows at most the online room limit", () => {
    const five = Array.from({ length: 5 }, () => room("dlx"));
    expect(checkRooms(five, types, free(9, 9)).general).toMatch(/up to 4 rooms/);
    expect(checkRooms([], types, free(9, 9)).ok).toBe(false);
  });
});

describe("pricing", () => {
  it("prices each room with its own type and children, then totals", () => {
    const q = quoteRooms([room("dlx", 2, 1), room("fam", 4), room(null)], types, 2);
    expect(q.lines[0]?.quote.totalPriceNpr).toBe(2 * 3000 + 2 * 1 * 500);
    expect(q.lines[1]?.quote.totalPriceNpr).toBe(2 * 4500);
    expect(q.lines[2]).toBeNull();
    expect(q.totalPriceNpr).toBe(7000 + 9000);
  });
});

describe("the room calculation", () => {
  const fmt = (n: number) => `NPR ${n.toLocaleString("en-US")}`;
  it("shows rate × nights, a child line when there are children, then the room total", () => {
    const withChild = quoteRooms([room("fam", 2, 1)], types, 2).lines[0]!.quote;
    expect(calculationLines(withChild, fmt)).toEqual(["NPR 4,500 × 2 nights = NPR 9,000", "NPR 500 × 1 child × 2 nights = NPR 1,000", "Room total: NPR 10,000"]);
    const none = quoteRooms([room("dlx")], types, 1).lines[0]!.quote;
    expect(calculationLines(none, fmt)).toEqual(["NPR 3,000 × 1 night = NPR 3,000", "Room total: NPR 3,000"]);
  });
});

describe("largest limits", () => {
  it("takes the most on each limit across types", () => {
    expect(largestCapacity([deluxe, family])).toEqual({ maxGuests: 6, maxAdults: 6, maxChildren: null });
    expect(largestCapacity([type("a", 4, 2, 1, 1), type("b", 3, 3, 1, 2)])).toEqual({ maxGuests: 4, maxAdults: 3, maxChildren: 2 });
  });
});
