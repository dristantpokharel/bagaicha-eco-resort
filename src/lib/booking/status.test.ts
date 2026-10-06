import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { canTransition, editableFlags, permissionForTransition } from "./status";

describe("status flow", () => {
  it("allows only the forward flow and cancellation from PENDING/CONFIRMED", () => {
    expect(canTransition("PENDING", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "CHECKED_IN")).toBe(true);
    expect(canTransition("CHECKED_IN", "CHECKED_OUT")).toBe(true);
    expect(canTransition("PENDING", "CANCELLED")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
  });
  it("blocks skips, reversals and cancelling after check-in", () => {
    expect(canTransition("PENDING", "CHECKED_IN")).toBe(false);
    expect(canTransition("CHECKED_IN", "CANCELLED")).toBe(false);
    expect(canTransition("CHECKED_OUT", "CONFIRMED")).toBe(false);
    expect(canTransition("CANCELLED", "PENDING")).toBe(false);
  });
});

describe("permissions", () => {
  it("cancel needs bookings.cancel, which Staff lack", () => {
    expect(permissionForTransition("CANCELLED")).toBe("bookings.cancel");
    expect((ROLE_PERMISSIONS.STAFF as readonly string[]).includes("bookings.cancel")).toBe(false);
    expect((ROLE_PERMISSIONS.ADMIN as readonly string[]).includes("bookings.cancel")).toBe(true);
  });
  it("other transitions need only changeStatus, which Staff have", () => {
    for (const to of ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] as const) {
      const p = permissionForTransition(to);
      expect(p).toBe("bookings.changeStatus");
      expect((ROLE_PERMISSIONS.STAFF as readonly string[]).includes(p)).toBe(true);
    }
  });
});

describe("editableFlags", () => {
  it("locks dates and room type after check-in, and everything but notes after the stay", () => {
    expect(editableFlags("CHECKED_IN")).toMatchObject({ checkIn: false, checkOut: true, roomType: false });
    expect(editableFlags("CHECKED_OUT")).toMatchObject({ checkIn: false, checkOut: false, notes: true });
    expect(editableFlags("CANCELLED").party).toBe(false);
  });
});
