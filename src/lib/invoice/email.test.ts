import { describe, expect, it } from "vitest";
import { renderInvoiceEmail } from "./email";

describe("invoice email output", () => {
  it("renders the four-column guest table without standard-rate or discount breakdowns", () => {
    const rendered = renderInvoiceEmail({
      number: "INV-2026-000001", reservationRef: "BG-1", guestSnapshot: { name: "Guest", email: "guest@example.test", phone: null, country: null },
      invoiceDate: new Date("2026-11-20T00:00:00Z"), checkIn: new Date("2026-12-01T00:00:00Z"), checkOut: new Date("2026-12-03T00:00:00Z"), nights: 2, issuedAt: new Date("2026-11-20T00:00:00Z"),
      status: "ISSUED", paymentMethod: null, paidAt: null, paymentNote: null,
      invoiceLines: [
        { id: "room", type: "ROOM", description: "Cottage", standardRateNpr: 3000, ratePerNightNpr: 2500, nights: 2, amountNpr: 5000, children: 0, childChargeNpr: 0 },
        { id: "tax", type: "TAX", description: "VAT 13%", calculation: "PERCENT", percentage: 13, amountNpr: 650 },
      ], roomLines: [], extraLines: [], subtotalNpr: 5000, taxTotalNpr: 650, discountTotalNpr: 0, grandTotalNpr: 5650,
    }, { name: "Resort", address: null, phones: [], emails: [], panVatNumber: null, invoiceFooterNote: null }, null);
    expect(rendered.html).toContain("Description");
    expect(rendered.html).toContain("Rate / night");
    expect(rendered.html).toContain("Nights");
    expect(rendered.html).toContain("Amount");
    expect(rendered.html).toContain("NPR 2,500");
    expect(rendered.html).not.toContain("Standard / night");
    expect(rendered.html).not.toContain("Standard NPR 3,000");
    expect(rendered.html).not.toContain("Total discount");
  });
  it("renders standalone quantities, bill-to address, and invoice date without a booking label", () => {
    const rendered = renderInvoiceEmail({
      number: "INV-2026-000002", reservationRef: null, guestSnapshot: { name: "Guest", email: null, phone: "9800000000", country: null, address: "Ward 2 <Bardiya>", referenceNote: "PO-2" },
      invoiceDate: new Date("2026-11-20T00:00:00Z"), checkIn: null, checkOut: null, nights: 0, issuedAt: new Date("2026-11-20T00:00:00Z"), status: "ISSUED", paymentMethod: null, paidAt: null, paymentNote: null,
      invoiceLines: [{ id: "1", type: "CHARGE", description: "Laundry", calculation: "QUANTITY", quantity: 2, unitAmountNpr: 100, amountNpr: 200 }],
      roomLines: [], extraLines: [], subtotalNpr: 200, taxTotalNpr: 0, discountTotalNpr: 0, grandTotalNpr: 200,
    }, { name: "Resort", address: null, phones: [], emails: [], panVatNumber: null, invoiceFooterNote: null }, null);
    expect(rendered.html).toContain("Ward 2 &lt;Bardiya&gt;");
    expect(rendered.html).toContain("PO-2");
    expect(rendered.html).toContain("Rate / night");
    expect(rendered.html).not.toContain("Booking:");
    expect(rendered.text).toContain("200");
  });
});
