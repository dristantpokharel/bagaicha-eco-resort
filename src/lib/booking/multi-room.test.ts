import { describe, expect, it } from "vitest";
import { BOOKING } from "@/config/booking";
import {
  quoteReservation,
  summariseRooms,
  validateSplit,
  type RoomTypeForBooking,
} from "./multi-room";

const deluxe: RoomTypeForBooking = { id: "dlx", name: "Deluxe Room", maxGuests: 3, maxAdults: 2, maxChildren: null, basePriceNpr: 3000, childPricePerNightNpr: 500 };
const family: RoomTypeForBooking = { id: "fam", name: "Family Room", maxGuests: 6, maxAdults: 6, maxChildren: null, basePriceNpr: 4500, childPricePerNightNpr: 500 };
const types = new Map([deluxe, family].map((t) => [t.id, t]));
const party = (adults: number, children: number) => ({ adults, children });

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

describe("summariseRooms", () => {
  it("counts rooms by name", () => {
    expect(summariseRooms(["Deluxe Room", "Family Room", "Deluxe Room"])).toBe("2× Deluxe Room, 1× Family Room");
  });
});
