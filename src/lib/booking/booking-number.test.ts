import { describe, expect, it } from "vitest";
import { formatBookingNumber } from "./booking-number";

describe("formatBookingNumber", () => {
  it("pads the sequence to six digits", () => {
    expect(formatBookingNumber(2026, 1)).toBe("BG-2026-000001");
    expect(formatBookingNumber(2026, BigInt(123))).toBe("BG-2026-000123");
  });
  it("keeps counting past six digits", () => {
    expect(formatBookingNumber(2027, 1234567)).toBe("BG-2027-1234567");
  });
});
