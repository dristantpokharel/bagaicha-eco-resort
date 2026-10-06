import { describe, expect, it } from "vitest";
import { enquirySchema, optionalPhone, publicBookingSchema } from "./schemas";

describe("optionalPhone", () => {
  it("treats blank and the bare prefilled country code as empty", () => {
    for (const v of [undefined, "", "  ", "+977", "+977 "]) expect(optionalPhone.parse(v)).toBeUndefined();
  });
  it("normalizes real numbers and rejects junk", () => {
    expect(optionalPhone.parse("98 0000 0000")).toBe("+9779800000000");
    expect(optionalPhone.safeParse("abc").success).toBe(false);
  });
});

describe("enquirySchema", () => {
  const base = { name: "Sita Rai", type: "EVENT", message: "We would like to host an event." };
  it("accepts email only (phone left as +977)", () => {
    const r = enquirySchema.safeParse({ ...base, email: " Sita@Example.com ", phone: "+977 " });
    expect(r.success && r.data.email).toBe("sita@example.com");
  });
  it("accepts phone only", () => {
    expect(enquirySchema.safeParse({ ...base, phone: "9800000000" }).success).toBe(true);
  });
  it("needs email or phone", () => {
    const r = enquirySchema.safeParse({ ...base, email: "", phone: "+977 " });
    expect(r.success).toBe(false);
  });
});

describe("publicBookingSchema", () => {
  const base = {
    checkIn: "2027-03-10", checkOut: "2027-03-12", adults: "2", children: "0", roomTypeId: "abc",
    name: "Sita Rai", email: "sita@example.com", phone: "9800000000",
  };
  it("normalizes phone, coerces counts and ignores unknown fields like price", () => {
    const r = publicBookingSchema.safeParse({ ...base, totalPriceNpr: "1" });
    expect(r.success && r.data.phone).toBe("+9779800000000");
    expect(r.success && r.data.adults).toBe(2);
    expect(r.success && "totalPriceNpr" in r.data).toBe(false);
  });
  it("requires email and phone", () => {
    expect(publicBookingSchema.safeParse({ ...base, email: "" }).success).toBe(false);
    expect(publicBookingSchema.safeParse({ ...base, phone: "+977 " }).success).toBe(false);
  });
});
