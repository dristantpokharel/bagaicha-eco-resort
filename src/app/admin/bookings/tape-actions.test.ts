import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  class AuthorizationError extends Error {
    constructor() {
      super("You don't have permission to do that.");
    }
  }
  return { AuthorizationError, role: "STAFF" as "STAFF" | "ADMIN" | "SUPERUSER" };
});

vi.mock("@/lib/auth/session", () => ({ AuthorizationError: h.AuthorizationError }));
vi.mock("@/lib/auth", async () => {
  const { can } = await import("@/lib/auth/permissions");
  return {
    requirePermission: vi.fn(async (permission: Parameters<typeof can>[1]) => {
      if (!can(h.role, permission)) throw new h.AuthorizationError();
      return { id: "u1", role: h.role, name: "Test", email: "t@example.test" };
    }),
  };
});
vi.mock("@/lib/db", () => ({ db: { $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({})) }, BOOKING_TX_OPTIONS: {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/booking/availability-data", () => ({ revalidateAvailability: vi.fn() }));
vi.mock("@/lib/email/booking-emails", () => ({ notifyReservation: vi.fn() }));
vi.mock("@/lib/booking/tape-service", () => ({ applyMove: vi.fn(), applyBlockMove: vi.fn() }));

import { ActionError } from "@/lib/actions";
import { db } from "@/lib/db";
import { revalidateAvailability } from "@/lib/booking/availability-data";
import { applyBlockMove, applyMove } from "@/lib/booking/tape-service";
import { notifyReservation } from "@/lib/email/booking-emails";
import { moveBlockAction, moveBookingAction } from "./tape-actions";

const outcome = {
  reservationId: "res1",
  reference: "BG-1",
  roomChanged: true,
  datesChanged: true,
  from: { roomId: "r1", room: "201", checkIn: "2032-03-10", checkOut: "2032-03-12", totalNpr: 10000 },
  to: { roomId: "r2", room: "202", checkIn: "2032-03-11", checkOut: "2032-03-14", totalNpr: 15000 },
  rooms: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.role = "STAFF";
  vi.mocked(applyMove).mockResolvedValue(outcome);
  vi.mocked(notifyReservation).mockResolvedValue({ guest: "sent", resort: "n/a" });
});

describe("moveBookingAction", () => {
  it("lets Staff move and resize bookings", async () => {
    const r = await moveBookingAction({ bookingId: "b1", roomId: "r2", checkIn: "2032-03-11", checkOut: "2032-03-14", notify: false });
    expect(r.ok).toBe(true);
    expect(applyMove).toHaveBeenCalledWith(expect.anything(), "u1", expect.objectContaining({ bookingId: "b1", roomId: "r2" }));
    expect(revalidateAvailability).toHaveBeenCalled();
  });

  it("reports the new room, dates and total", async () => {
    const r = await moveBookingAction({ bookingId: "b1", roomId: "r2", notify: false });
    expect(r.ok && r.message).toMatch(/BG-1: moved to room 202; now 11 Mar to 14 Mar \(3 nights\); total .*15,?000.*was .*10,?000/);
  });

  it("gives back an undo with the old room and dates", async () => {
    const r = await moveBookingAction({ bookingId: "b1", roomId: "r2", checkIn: "2032-03-11", checkOut: "2032-03-14", notify: false });
    expect(r.ok && r.undo).toEqual({ kind: "move", bookingId: "b1", roomId: "r1", checkIn: "2032-03-10", checkOut: "2032-03-12", notify: false });
  });

  it("emails the guest when asked, and the undo emails again", async () => {
    const r = await moveBookingAction({ bookingId: "b1", checkOut: "2032-03-14", notify: true });
    expect(notifyReservation).toHaveBeenCalledWith("modified", "res1");
    expect(r.ok && r.emailed).toBe(true);
    expect(r.ok && r.undo).toMatchObject({ notify: true });
  });

  it("doesn't email when not asked, and the undo stays silent", async () => {
    const r = await moveBookingAction({ bookingId: "b1", roomId: "r2", notify: false });
    expect(notifyReservation).not.toHaveBeenCalled();
    expect(r.ok && r.undo).toMatchObject({ notify: false });
  });

  it("keeps the change when the email fails, and says so", async () => {
    vi.mocked(notifyReservation).mockResolvedValue({ guest: "failed", resort: "n/a" });
    const r = await moveBookingAction({ bookingId: "b1", roomId: "r2", notify: true });
    expect(r.ok && r.message).toMatch(/could not be sent/);
    expect(r.ok && r.emailed).toBe(false);
    expect(r.ok && r.undo).toMatchObject({ notify: false });
  });

  it("an undo call has no undo of its own", async () => {
    const r = await moveBookingAction({ bookingId: "b1", roomId: "r1", notify: false, undo: true });
    expect(r.ok && r.undo).toBeNull();
    expect(r.ok && r.message).toMatch(/^Undone: /);
  });

  it("explains a refused move", async () => {
    vi.mocked(applyMove).mockRejectedValue(new ActionError("202 is already booked for overlapping dates (BG-2)."));
    const r = await moveBookingAction({ bookingId: "b1", roomId: "r2", notify: false });
    expect(r).toEqual({ ok: false, error: "202 is already booked for overlapping dates (BG-2)." });
    expect(revalidateAvailability).not.toHaveBeenCalled();
  });

  it("maps the database's overlap constraint to a friendly message", async () => {
    vi.mocked(db.$transaction).mockRejectedValueOnce(Object.assign(new Error("x"), { code: "23P01" }));
    const r = await moveBookingAction({ bookingId: "b1", roomId: "r2", notify: false });
    expect(!r.ok && r.error).toMatch(/just booked for overlapping dates/);
  });

  it("rejects malformed input before touching the database", async () => {
    const r = await moveBookingAction({ bookingId: "", notify: false });
    expect(r.ok).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("moveBlockAction", () => {
  const blockOutcome = {
    room: "301",
    from: { roomId: "r3", room: "301", startDate: "2032-03-15", endDate: "2032-03-18" },
    to: { room: "301", startDate: "2032-03-16", endDate: "2032-03-19" },
  };

  it("refuses Staff without touching the database", async () => {
    const r = await moveBlockAction({ blockId: "k1", startDate: "2032-03-16" });
    expect(r).toEqual({ ok: false, error: "You don't have permission to do that." });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it.each(["ADMIN", "SUPERUSER"] as const)("lets %s move blocks, with an undo", async (role) => {
    h.role = role;
    vi.mocked(applyBlockMove).mockResolvedValue(blockOutcome);
    const r = await moveBlockAction({ blockId: "k1", startDate: "2032-03-16", endDate: "2032-03-19" });
    expect(r.ok && r.undo).toEqual({ kind: "block", blockId: "k1", roomId: "r3", startDate: "2032-03-15", endDate: "2032-03-18" });
  });
});
