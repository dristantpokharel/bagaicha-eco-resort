import { describe, expect, it } from "vitest";
import { BOOKING } from "@/config/booking";
import { partyFits } from "./capacity";
import {
  canSeat,
  canSeatFromFree,
  quoteReservation,
  splitParty,
  summariseRooms,
  suggestCombination,
  validateSplit,
  type RoomTypeForBooking,
} from "./multi-room";

const deluxe: RoomTypeForBooking = { id: "dlx", name: "Deluxe Room", maxGuests: 3, maxAdults: 2, maxChildren: null, basePriceNpr: 3000, childPricePerNightNpr: 500 };
const family: RoomTypeForBooking = { id: "fam", name: "Family Room", maxGuests: 6, maxAdults: 6, maxChildren: null, basePriceNpr: 4500, childPricePerNightNpr: 500 };
const types = new Map([deluxe, family].map((t) => [t.id, t]));
const party = (adults: number, children: number) => ({ adults, children });

describe("splitParty", () => {
  it("gives every room an adult and seats everyone", () => {
    const split = splitParty(party(4, 2), [deluxe, deluxe]);
    expect(split.reduce((n, p) => n + p.adults, 0)).toBe(4);
    expect(split.reduce((n, p) => n + p.children, 0)).toBe(2);
    split.forEach((p) => expect(partyFits(deluxe, p)).toBe(true));
  });
  it("splits 2 Deluxe + 1 Family for 6A+2C within every limit", () => {
    const caps = [deluxe, deluxe, family];
    const split = splitParty(party(6, 2), caps);
    expect(split.reduce((n, p) => n + p.adults + p.children, 0)).toBe(8);
    split.forEach((p, i) => expect(partyFits(caps[i], p)).toBe(true));
  });
  it("finds a split greedy placing would miss (limited child rooms)", () => {
    const noKids: RoomTypeForBooking = { ...deluxe, id: "nk", maxChildren: 0 };
    const caps = [noKids, family];
    const split = splitParty(party(2, 3), caps);
    split.forEach((p, i) => expect(partyFits(caps[i], p)).toBe(true));
    expect(split[0].children).toBe(0);
  });
  it("returns a best attempt that validateSplit rejects when the party can't fit", () => {
    const split = splitParty(party(5, 0), [deluxe, deluxe]);
    const lines = split.map((p, i) => ({ roomTypeId: "dlx", ...p, index: i }));
    expect(validateSplit(lines, types, party(5, 0)).ok).toBe(false);
  });
});

describe("validateSplit", () => {
  const line = (roomTypeId: string, adults: number, children = 0) => ({ roomTypeId, adults, children });

  it("accepts a split that fits and places everyone", () => {
    expect(validateSplit([line("dlx", 2, 1), line("fam", 3)], types, party(5, 1)).ok).toBe(true);
  });
  it("explains a room that doesn't fit", () => {
    const r = validateSplit([line("dlx", 3)], types, party(3, 0));
    expect(r.ok).toBe(false);
    expect(r.lineErrors[0]).toMatch(/Room 1 \(Deluxe Room\).*up to 2 adults/);
  });
  it("explains guests not placed and guests placed twice", () => {
    expect(validateSplit([line("dlx", 2)], types, party(3, 1)).errors).toEqual([
      "1 adult is not placed in a room yet.",
      "1 child is not placed in a room yet.",
    ]);
    expect(validateSplit([line("dlx", 2), line("dlx", 2)], types, party(3, 0)).errors[0]).toMatch(/1 adult too many/);
  });
  it("needs at least one room and refuses a fifth online", () => {
    expect(validateSplit([], types, party(1, 0)).errors[0]).toMatch(/at least one room/i);
    const five = Array.from({ length: 5 }, () => line("dlx", 1));
    const r = validateSplit(five, types, party(5, 0));
    expect(BOOKING.maxRoomsPerRequest).toBe(4);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/up to 4 rooms.*enquiry/);
  });
  it("lets staff go past the cap when maxRooms is null", () => {
    const five = Array.from({ length: 5 }, () => line("dlx", 1));
    expect(validateSplit(five, types, party(5, 0), { maxRooms: null }).ok).toBe(true);
  });
  it("rejects an unknown room type", () => {
    expect(validateSplit([line("nope", 1)], types, party(1, 0)).lineErrors[0]).toMatch(/isn't available/);
  });
});

describe("quoteReservation", () => {
  it("prices 2 Deluxe + 1 Family per room, then in total", () => {
    const lines = [
      { roomTypeId: "dlx", adults: 2, children: 1 },
      { roomTypeId: "dlx", adults: 2, children: 0 },
      { roomTypeId: "fam", adults: 3, children: 2 },
    ];
    const q = quoteReservation(lines, types, 2);
    expect(q.lines.map((l) => l.totalPriceNpr)).toEqual([6000 + 1000, 6000, 9000 + 2000]);
    expect(q.totalPriceNpr).toBe(24000);
  });
  it("refuses a room type it has no price for", () => {
    expect(() => quoteReservation([{ roomTypeId: "x", adults: 1, children: 0 }], types, 1)).toThrow();
  });
});

describe("combinations", () => {
  const free = (d: number, f: number) => [
    { type: deluxe, free: d },
    { type: family, free: f },
  ];

  it("canSeat needs an adult in every room", () => {
    expect(canSeat([deluxe, deluxe], party(1, 2))).toBe(false);
    expect(canSeat([deluxe, deluxe], party(2, 2))).toBe(true);
  });
  it("suggests the fewest rooms, then the cheapest", () => {
    const s = suggestCombination(party(7, 1), free(2, 1), 1);
    expect(s?.lines.map((l) => l.roomTypeId).sort()).toEqual(["dlx", "fam"]);
    expect(s?.quote.totalPriceNpr).toBe(3000 + 4500 + 500);
  });
  it("suggests 1 Family + 1 Deluxe for 8 when no single room fits", () => {
    const s = suggestCombination(party(7, 1), free(1, 1), 2);
    expect(s?.lines).toHaveLength(2);
    s?.lines.forEach((l) => expect(partyFits(types.get(l.roomTypeId)!, l)).toBe(true));
  });
  it("uses only free rooms and returns null when nothing works", () => {
    expect(suggestCombination(party(8, 0), free(0, 1), 1)).toBeNull();
    expect(suggestCombination(party(8, 0), free(2, 0), 1)).toBeNull();
  });
  it("never goes past the 4-room limit", () => {
    expect(canSeatFromFree(party(8, 0), [{ type: deluxe, free: 5 }])).toBe(true);
    expect(canSeatFromFree(party(10, 0), [{ type: deluxe, free: 5 }])).toBe(false);
    expect(canSeatFromFree(party(10, 0), [{ type: deluxe, free: 5 }], 5)).toBe(true);
  });
});

describe("summariseRooms", () => {
  it("counts rooms by name", () => {
    expect(summariseRooms(["Deluxe Room", "Family Room", "Deluxe Room"])).toBe("2× Deluxe Room, 1× Family Room");
  });
});
