import { describe, expect, it } from "vitest";
import { invoiceIssuedHref } from "./navigation";

describe("invoice issue redirect", () => {
  it("redirects a successful issue to its invoice page with the issued notice flag", () => {
    expect(invoiceIssuedHref("invoice-id")).toBe("/admin/invoices/invoice-id?issued=1");
    expect(invoiceIssuedHref("x/y")).toBe("/admin/invoices/x%2Fy?issued=1");
  });
});
