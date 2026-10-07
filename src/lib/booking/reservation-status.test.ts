import { describe, expect, it } from "vitest";
import type { BookingStatus } from "@/generated/prisma/enums";
import { deriveReservationStatus } from "./reservation-status";

const lines = (...statuses: BookingStatus[]) => statuses.map((status) => ({ status }));

describe("deriveReservationStatus", () => {
  it("is pending while nothing is confirmed", () => {
    expect(deriveReservationStatus(lines("PENDING", "PENDING"))).toBe("PENDING");
    expect(deriveReservationStatus(lines("PENDING", "CANCELLED"))).toBe("PENDING");
  });
  it("is confirmed when every line is confirmed or later", () => {
    expect(deriveReservationStatus(lines("CONFIRMED"))).toBe("CONFIRMED");
    expect(deriveReservationStatus(lines("CONFIRMED", "CHECKED_IN", "CHECKED_OUT"))).toBe("CONFIRMED");
  });
  it("is partially confirmed with a pending or cancelled line next to a confirmed one", () => {
    expect(deriveReservationStatus(lines("CONFIRMED", "PENDING"))).toBe("PARTIALLY_CONFIRMED");
    expect(deriveReservationStatus(lines("CONFIRMED", "CONFIRMED", "CANCELLED"))).toBe("PARTIALLY_CONFIRMED");
  });
  it("is cancelled when every line is", () => {
    expect(deriveReservationStatus(lines("CANCELLED", "CANCELLED"))).toBe("CANCELLED");
  });
  it("is completed when all kept lines are checked out", () => {
    expect(deriveReservationStatus(lines("CHECKED_OUT", "CHECKED_OUT"))).toBe("COMPLETED");
    expect(deriveReservationStatus(lines("CHECKED_OUT", "CANCELLED"))).toBe("COMPLETED");
    expect(deriveReservationStatus(lines("CHECKED_OUT", "CHECKED_IN"))).toBe("CONFIRMED");
  });
});
