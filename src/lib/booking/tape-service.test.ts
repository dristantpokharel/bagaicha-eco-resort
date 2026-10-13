import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ AuthorizationError: class extends Error {} }));

import { ActionError } from "@/lib/actions";
import { parseDateOnly } from "./dates";
import { planMove } from "./tape-service";

const d = (s: string) => parseDateOnly(s)!;
const today = d("2032-03-10");

type Status = "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";
const reservation = (lines: [string, Status, string | null][], checkIn = "2032-03-12", checkOut = "2032-03-14") =>
  ({
    id: "res1",
    reference: "BG-1",
    checkIn: d(checkIn),
    checkOut: d(checkOut),
    totalPriceNpr: 0,
    bookings: lines.map(([id, status, roomId]) => ({ id, status, roomId, roomTypeId: "t1", checkIn: d(checkIn), checkOut: d(checkOut) })),
  }) as unknown as Parameters<typeof planMove>[0];

const refuses = (fn: () => unknown, message: RegExp) => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ActionError);
    expect((error as Error).message).toMatch(message);
    return;
  }
  throw new Error("expected a refusal");
};

describe("planMove", () => {
  it("plans a room change for a confirmed room", () => {
    expect(planMove(reservation([["a", "CONFIRMED", "r1"]]), { bookingId: "a", roomId: "r2" }, today)).toMatchObject({ roomId: "r2", roomChanged: true, datesChanged: false });
  });

  it("plans a date change for the whole reservation, keeping the room", () => {
    const plan = planMove(reservation([["a", "CONFIRMED", "r1"]]), { bookingId: "a", checkIn: "2032-03-13", checkOut: "2032-03-16" }, today);
    expect(plan).toMatchObject({ roomId: "r1", roomChanged: false, datesChanged: true });
    expect(plan.checkOut).toEqual(d("2032-03-16"));
  });

  it("plans a room and date change together", () => {
    expect(planMove(reservation([["a", "CONFIRMED", "r1"]]), { bookingId: "a", roomId: "r2", checkOut: "2032-03-15" }, today)).toMatchObject({ roomChanged: true, datesChanged: true });
  });

  it("refuses a change of check-in once guests are in, but allows a later check-out", () => {
    const checkedIn = reservation([["a", "CHECKED_IN", "r1"]], "2032-03-08", "2032-03-11");
    refuses(() => planMove(checkedIn, { bookingId: "a", checkIn: "2032-03-09" }, today), /Check-in can't change/);
    expect(planMove(checkedIn, { bookingId: "a", checkOut: "2032-03-13" }, today)).toMatchObject({ datesChanged: true });
  });

  it("refuses moving a checked-in room to another room", () => {
    refuses(() => planMove(reservation([["a", "CHECKED_IN", "r1"]]), { bookingId: "a", roomId: "r2" }, today), /stay in their room/);
  });

  it("refuses checked-out and cancelled rooms", () => {
    refuses(() => planMove(reservation([["a", "CHECKED_OUT", "r1"]]), { bookingId: "a", roomId: "r2" }, today), /checked out/);
    refuses(() => planMove(reservation([["a", "CANCELLED", null]]), { bookingId: "a", checkOut: "2032-03-20" }, today), /cancelled/);
  });

  it("refuses a late check-out change once any room has checked out", () => {
    const mixed = reservation([["a", "CONFIRMED", "r1"], ["b", "CHECKED_OUT", "r2"]]);
    refuses(() => planMove(mixed, { bookingId: "a", checkOut: "2032-03-20" }, today), /can't end on another day/);
  });

  it("sends pending rooms to Assign & confirm for a room", () => {
    refuses(() => planMove(reservation([["a", "PENDING", null]]), { bookingId: "a", roomId: "r2" }, today), /Assign & confirm/);
  });

  it("lets a pending room's dates change", () => {
    expect(planMove(reservation([["a", "PENDING", null]]), { bookingId: "a", checkIn: "2032-03-20", checkOut: "2032-03-22" }, today)).toMatchObject({ datesChanged: true, roomId: null });
  });

  it("refuses zero nights and malformed dates", () => {
    refuses(() => planMove(reservation([["a", "CONFIRMED", "r1"]]), { bookingId: "a", checkOut: "2032-03-12" }, today), /after check-in/);
    refuses(() => planMove(reservation([["a", "CONFIRMED", "r1"]]), { bookingId: "a", checkOut: "soon" }, today), /check-out/i);
  });

  it("refuses an unknown room line", () => {
    refuses(() => planMove(reservation([["a", "CONFIRMED", "r1"]]), { bookingId: "zzz", roomId: "r2" }, today), /no longer exists/);
  });

  it("reports an unchanged request as no change", () => {
    expect(planMove(reservation([["a", "CONFIRMED", "r1"]]), { bookingId: "a", roomId: "r1", checkIn: "2032-03-12" }, today)).toMatchObject({ roomChanged: false, datesChanged: false });
  });
});
