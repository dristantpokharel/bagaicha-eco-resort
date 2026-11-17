import { describe, expect, it } from "vitest";
import { can } from "@/lib/auth/permissions";

describe("invoice permissions", () => {
  it("lets Staff view invoices while restricting every mutation to Admin+", () => {
    expect(can("STAFF", "invoices.view")).toBe(true);
    expect(can("STAFF", "invoices.issue")).toBe(false);
    expect(can("ADMIN", "invoices.issue")).toBe(true);
    expect(can("SUPERUSER", "invoices.issue")).toBe(true);
  });
});
