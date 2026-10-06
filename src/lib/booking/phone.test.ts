import { describe, expect, it } from "vitest";
import { normalizePhone, whatsappUrl } from "./phone";

describe("normalizePhone", () => {
  it("adds +977 to local numbers and drops a leading 0", () => {
    expect(normalizePhone("9812345678")).toBe("+9779812345678");
    expect(normalizePhone("098-1234 5678")).toBe("+9779812345678");
  });
  it("keeps other international numbers", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalizePhone("0091 98765 43210")).toBe("+919876543210");
  });
  it("accepts 977 typed without the plus", () => {
    expect(normalizePhone("977 9812345678")).toBe("+9779812345678");
  });
  it("is idempotent", () => {
    expect(normalizePhone(normalizePhone("9812345678")!)).toBe("+9779812345678");
  });
  it("rejects junk and out-of-range lengths", () => {
    for (const bad of ["", "abc", "12", "+1234567890123456", "98-12x"]) expect(normalizePhone(bad)).toBeNull();
  });
});

describe("whatsappUrl", () => {
  it("uses digits only", () => {
    expect(whatsappUrl("+9779812345678")).toBe("https://wa.me/9779812345678");
  });
});
