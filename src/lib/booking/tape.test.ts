import { describe, expect, it } from "vitest";
import {
  buildProposal,
  candidateFor,
  capabilities,
  evaluate,
  freeRun,
  packLanes,
  priceImpact,
  type Candidate,
  type TapeBar,
  type TapeData,
  type TapeLine,
} from "./tape";

const line = (id: string, status: TapeLine["status"], roomId: string | null, extra: Partial<TapeLine> = {}): TapeLine => ({
  id,
  status,
  roomId,
  roomTypeId: "deluxe",
  children: 0,
  pricePerNightNpr: 5000,
  childPricePerNightNpr: 1000,
  totalPriceNpr: 10000,
  ...extra,
});
const booking = (id: string, reservationId: string, status: TapeBar["status"], roomId: string | null, checkIn: string, checkOut: string, extra: Partial<TapeBar> = {}): TapeBar => ({
  id,
  kind: "booking",
  reservationId,
  reference: `BG-${reservationId}`,
  title: `Guest ${reservationId}`,
  status,
  roomId,
  roomTypeId: "deluxe",
  checkIn,
  checkOut,
  ...extra,
});

const data: TapeData = {
  today: "2032-03-10",
  types: [
    { id: "deluxe", name: "Deluxe", rooms: [201, 202, 203, 204].map((n) => ({ id: `r${n}`, name: String(n), typeId: "deluxe", isActive: true })) },
    { id: "family", name: "Family", rooms: [{ id: "r301", name: "301", typeId: "family", isActive: true }] },
  ],
  bars: [
    booking("b1", "R1", "CONFIRMED", "r201", "2032-03-10", "2032-03-12"),
    booking("b2", "R2", "CONFIRMED", "r202", "2032-03-11", "2032-03-13"),
    booking("b3", "R3", "CHECKED_IN", "r203", "2032-03-08", "2032-03-11"),
    booking("b4", "R4", "PENDING", null, "2032-03-14", "2032-03-16"),
    // R5: two rooms, one in 201 later, one in 204.
    booking("b5a", "R5", "CONFIRMED", "r201", "2032-03-20", "2032-03-22"),
    booking("b5b", "R5", "CONFIRMED", "r204", "2032-03-20", "2032-03-22"),
    booking("b6", "R6", "CONFIRMED", "r204", "2032-03-22", "2032-03-24"),
    booking("b7", "R7", "CHECKED_OUT", "r202", "2032-03-05", "2032-03-08"),
    { id: "k1", kind: "block", reservationId: null, reference: null, title: "Repairs", status: null, roomId: "r301", roomTypeId: null, checkIn: "2032-03-15", checkOut: "2032-03-18" },
  ],
  reservations: {
    R1: { id: "R1", reference: "BG-R1", guestName: "Guest R1", hasEmail: true, lines: [line("b1", "CONFIRMED", "r201")] },
    R2: { id: "R2", reference: "BG-R2", guestName: "Guest R2", hasEmail: false, lines: [line("b2", "CONFIRMED", "r202")] },
    R3: { id: "R3", reference: "BG-R3", guestName: "Guest R3", hasEmail: true, lines: [line("b3", "CHECKED_IN", "r203", { totalPriceNpr: 15000 })] },
    R4: { id: "R4", reference: "BG-R4", guestName: "Guest R4", hasEmail: true, lines: [line("b4", "PENDING", null)] },
    R5: { id: "R5", reference: "BG-R5", guestName: "Guest R5", hasEmail: true, lines: [line("b5a", "CONFIRMED", "r201"), line("b5b", "CONFIRMED", "r204")] },
    R6: { id: "R6", reference: "BG-R6", guestName: "Guest R6", hasEmail: true, lines: [line("b6", "CONFIRMED", "r204")] },
    R7: { id: "R7", reference: "BG-R7", guestName: "Guest R7", hasEmail: true, lines: [line("b7", "CHECKED_OUT", "r202", { totalPriceNpr: 15000 })] },
  },
};
const bar = (id: string) => data.bars.find((b) => b.id === id)!;
const ctx = { canBlock: false };
const adminCtx = { canBlock: true };
const to = (b: TapeBar, over: Partial<Candidate>): Candidate => ({ roomId: b.roomId, typeId: b.roomTypeId, checkIn: b.checkIn, checkOut: b.checkOut, ...over });

describe("capabilities", () => {
  it("lets a confirmed stay move, shift and resize", () => {
    expect(capabilities(bar("b1"), data, false)).toEqual({ drag: true, room: true, shift: true, start: true, end: true });
  });
  it("lets a checked-in stay change only its check-out", () => {
    expect(capabilities(bar("b3"), data, false)).toEqual({ drag: true, room: false, shift: false, start: false, end: true });
  });
  it("freezes checked-out and cancelled stays", () => {
    expect(capabilities(bar("b7"), data, false).drag).toBe(false);
    expect(capabilities({ ...bar("b1"), status: "CANCELLED" }, data, false).drag).toBe(false);
  });
  it("lets only Admin and above touch blocks", () => {
    expect(capabilities(bar("k1"), data, false).drag).toBe(false);
    expect(capabilities(bar("k1"), data, true)).toMatchObject({ drag: true, room: true, shift: true });
  });
});

describe("moving to another room", () => {
  it("allows a free room of the same type", () => {
    expect(evaluate(bar("b1"), to(bar("b1"), { roomId: "r204" }), data, ctx)).toMatchObject({ ok: true, op: "move", roomChanged: true, datesChanged: false });
  });
  it("refuses a busy room, naming the booking in it", () => {
    const r = evaluate(bar("b1"), to(bar("b1"), { roomId: "r202" }), data, ctx);
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.reason).toMatch(/202 is already booked.*BG-R2/);
  });
  it("refuses a room of another type", () => {
    const r = evaluate(bar("b1"), to(bar("b1"), { roomId: "r301", typeId: "family" }), data, ctx);
    expect(!r.ok && r.reason).toMatch(/Room type can't change/);
  });
  it("refuses sending a confirmed room back to unassigned", () => {
    const r = evaluate(bar("b1"), to(bar("b1"), { roomId: null }), data, ctx);
    expect(!r.ok && r.reason).toMatch(/unassigned/);
  });
  it("refuses moving a checked-in stay to another room", () => {
    const r = evaluate(bar("b3"), to(bar("b3"), { roomId: "r204" }), data, ctx);
    expect(!r.ok && r.reason).toMatch(/stays in its room/);
  });
  it("treats an unchanged drop as nothing to do", () => {
    expect(evaluate(bar("b1"), to(bar("b1"), {}), data, ctx)).toMatchObject({ ok: false, noop: true });
  });
});

describe("changing dates", () => {
  it("allows shifting into free nights, and extending", () => {
    expect(evaluate(bar("b1"), to(bar("b1"), { checkIn: "2032-03-12", checkOut: "2032-03-14" }), data, ctx)).toMatchObject({ ok: true, datesChanged: true });
    expect(evaluate(bar("b1"), to(bar("b1"), { checkOut: "2032-03-13" }), data, ctx)).toMatchObject({ ok: true });
  });
  it("refuses extending into a conflict", () => {
    const r = evaluate(bar("b6"), to(bar("b6"), { checkIn: "2032-03-21" }), data, ctx);
    expect(!r.ok && r.reason).toMatch(/204 is already booked.*BG-R5/);
  });
  it("lets the check-out day be the next guest's check-in", () => {
    expect(evaluate(bar("b1"), to(bar("b1"), { checkOut: "2032-03-12" }), data, ctx)).toMatchObject({ ok: false, noop: true });
    expect(evaluate(bar("b6"), to(bar("b6"), { checkIn: "2032-03-22", checkOut: "2032-03-25" }), data, ctx)).toMatchObject({ ok: true });
  });
  it("refuses zero or negative nights", () => {
    const r = evaluate(bar("b1"), to(bar("b1"), { checkOut: "2032-03-10" }), data, ctx);
    expect(!r.ok && r.reason).toMatch(/at least one night/);
  });
  it("checks every room of the reservation, not just the dragged one", () => {
    // R5's second room (204) would run into R6 (22–24) if the stay is extended by a night.
    const r = evaluate(bar("b5a"), to(bar("b5a"), { checkOut: "2032-03-23" }), data, ctx);
    expect(!r.ok && r.reason).toMatch(/204 is already booked.*another room of the same booking/);
  });
  it("lets a checked-in stay change only its check-out", () => {
    expect(evaluate(bar("b3"), to(bar("b3"), { checkOut: "2032-03-12" }), data, ctx)).toMatchObject({ ok: true, datesChanged: true });
    const r = evaluate(bar("b3"), to(bar("b3"), { checkIn: "2032-03-09" }), data, ctx);
    expect(!r.ok && r.reason).toMatch(/Check-in can't change/);
  });
  it("refuses changes to checked-out stays", () => {
    expect(evaluate(bar("b7"), to(bar("b7"), { checkOut: "2032-03-09" }), data, ctx)).toMatchObject({ ok: false });
  });
});

describe("assigning an unassigned request", () => {
  it("assigns it to a free room of its type for the dates it has", () => {
    expect(evaluate(bar("b4"), to(bar("b4"), { roomId: "r203" }), data, ctx)).toMatchObject({ ok: true, op: "assign" });
  });
  it("refuses a busy room or another type", () => {
    expect(evaluate(bar("b4"), to(bar("b4"), { roomId: "r204", checkIn: "2032-03-14" }), data, ctx)).toMatchObject({ ok: true });
    const r = evaluate(bar("b4"), to(bar("b4"), { roomId: "r301", typeId: "family" }), data, ctx);
    expect(!r.ok && r.reason).toMatch(/Room type/);
  });
  it("ignores sideways movement when dropping on a room", () => {
    const caps = capabilities(bar("b4"), data, false);
    const c = candidateFor(bar("b4"), "move", 3, { roomId: "r203", typeId: "deluxe" }, caps);
    expect(c).toMatchObject({ roomId: "r203", checkIn: "2032-03-14", checkOut: "2032-03-16" });
  });
  it("still lets an unassigned request change its dates in the unassigned lane", () => {
    const caps = capabilities(bar("b4"), data, false);
    const c = candidateFor(bar("b4"), "move", 3, { roomId: null, typeId: "deluxe" }, caps);
    expect(evaluate(bar("b4"), c, data, ctx)).toMatchObject({ ok: true, op: "move", datesChanged: true });
  });
  it("won't assign and change dates in one go", () => {
    const r = evaluate(bar("b4"), to(bar("b4"), { roomId: "r203", checkIn: "2032-03-15" }), data, ctx);
    expect(!r.ok && r.reason).toMatch(/Assign the room first/);
  });
});

describe("blocks", () => {
  it("can be moved by an admin to a free spot, not onto a booking", () => {
    expect(evaluate(bar("k1"), to(bar("k1"), { checkIn: "2032-03-16", checkOut: "2032-03-19" }), data, adminCtx)).toMatchObject({ ok: true, op: "block" });
    const r = evaluate(bar("k1"), to(bar("k1"), { roomId: "r204", typeId: "deluxe", checkIn: "2032-03-20" , checkOut: "2032-03-22" }), data, adminCtx);
    expect(!r.ok && r.reason).toMatch(/already booked/);
  });
  it("is refused for staff", () => {
    const r = evaluate(bar("k1"), to(bar("k1"), { checkOut: "2032-03-19" }), data, ctx);
    expect(!r.ok && r.reason).toMatch(/Only an Admin/);
  });
});

describe("candidateFor", () => {
  it("shifts both dates by the drag distance, or one edge", () => {
    const caps = capabilities(bar("b1"), data, false);
    const row = { roomId: "r201", typeId: "deluxe" };
    expect(candidateFor(bar("b1"), "move", 2, row, caps)).toMatchObject({ checkIn: "2032-03-12", checkOut: "2032-03-14" });
    expect(candidateFor(bar("b1"), "start", -1, row, caps)).toMatchObject({ checkIn: "2032-03-09", checkOut: "2032-03-12", roomId: "r201" });
    expect(candidateFor(bar("b1"), "end", 3, row, caps)).toMatchObject({ checkIn: "2032-03-10", checkOut: "2032-03-15" });
  });
  it("doesn't shift a checked-in stay sideways", () => {
    const caps = capabilities(bar("b3"), data, false);
    expect(candidateFor(bar("b3"), "move", 2, { roomId: "r203", typeId: "deluxe" }, caps)).toMatchObject({ checkIn: "2032-03-08", checkOut: "2032-03-11" });
  });
});

describe("price impact and proposals", () => {
  it("reprices every open room from its own rates", () => {
    // R5: two rooms at 5,000 a night. Two nights = 20,000; three nights = 30,000.
    expect(priceImpact(bar("b5a"), { checkIn: "2032-03-20", checkOut: "2032-03-23" }, data)).toEqual({ before: 20000, after: 30000, rooms: 2 });
  });
  it("includes children at the room's snapshot child rate", () => {
    const withKid: TapeData = { ...data, reservations: { ...data.reservations, R1: { ...data.reservations.R1, lines: [line("b1", "CONFIRMED", "r201", { children: 2, totalPriceNpr: 14000 })] } } };
    expect(priceImpact(bar("b1"), { checkIn: "2032-03-10", checkOut: "2032-03-13" }, withKid)).toMatchObject({ before: 14000, after: 3 * 5000 + 3 * 2 * 1000 });
  });
  it("leaves checked-out rooms of the reservation at their price", () => {
    const mixed: TapeData = {
      ...data,
      reservations: { ...data.reservations, R5: { ...data.reservations.R5, lines: [line("b5a", "CONFIRMED", "r201"), line("b5b", "CHECKED_OUT", "r204", { totalPriceNpr: 7777 })] } },
    };
    expect(priceImpact(bar("b5a"), { checkIn: "2032-03-20", checkOut: "2032-03-23" }, mixed)).toEqual({ before: 17777, after: 22777, rooms: 1 });
  });
  it("defaults the guest email on for date changes and off for room swaps", () => {
    const dates = buildProposal(bar("b1"), to(bar("b1"), { checkOut: "2032-03-13" }), data, ctx);
    const swap = buildProposal(bar("b1"), to(bar("b1"), { roomId: "r204" }), data, ctx);
    expect(dates.ok && dates.proposal).toMatchObject({ defaultNotify: true, guestHasEmail: true, price: { before: 10000, after: 15000 } });
    expect(swap.ok && swap.proposal).toMatchObject({ defaultNotify: false, price: null, rooms: 1 });
  });
  it("counts the rooms a date change moves together", () => {
    const p = buildProposal(bar("b5a"), to(bar("b5a"), { checkIn: "2032-03-19" }), data, ctx);
    expect(p.ok && p.proposal.rooms).toBe(2);
  });
});

describe("layout helpers", () => {
  it("packs overlapping bars into separate lanes", () => {
    const lanes = packLanes([
      { id: "a", checkIn: "2032-03-10", checkOut: "2032-03-12" },
      { id: "b", checkIn: "2032-03-11", checkOut: "2032-03-13" },
      { id: "c", checkIn: "2032-03-12", checkOut: "2032-03-14" },
    ]);
    expect(lanes.map((l) => l.map((x) => x.id))).toEqual([["a", "c"], ["b"]]);
  });
  it("limits a drag-selection to the free nights next to where it started", () => {
    expect(freeRun(data, "r201", "2032-03-12", "2032-03-14")).toEqual({ checkIn: "2032-03-12", checkOut: "2032-03-15" });
    expect(freeRun(data, "r201", "2032-03-13", "2032-03-21")).toEqual({ checkIn: "2032-03-13", checkOut: "2032-03-20" });
    expect(freeRun(data, "r201", "2032-03-13", "2032-03-11")).toEqual({ checkIn: "2032-03-12", checkOut: "2032-03-14" });
    expect(freeRun(data, "r201", "2032-03-10", "2032-03-11")).toBeNull();
  });
});
