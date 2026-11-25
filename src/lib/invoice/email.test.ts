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
      ], taxLines: [{ id: "tax", label: "VAT", mode: "PERCENT", percentage: 13, baseNpr: 5000, amountNpr: 650 }], roomLines: [], extraLines: [], subtotalNpr: 5000, taxTotalNpr: 650, discountTotalNpr: 0, grandTotalNpr: 5650,
    }, { name: "Resort", address: null, phones: [], emails: [], panVatNumber: null, invoiceFooterNote: null }, null);
    expect(rendered.html).toContain("Description");
    expect(rendered.html).toContain("Qty / nights");
    expect(rendered.html).toContain("VAT 13% on NPR 5,000");
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
    expect(rendered.html).toContain("Rate</th>");
    expect(rendered.html).not.toContain("Booking:");
    expect(rendered.text).toContain("200");
  });
  it("adds the contact footer to the invoice email when contact details are given", () => {
    const base = {
      number: "INV-2026-000003", reservationRef: null, guestSnapshot: { name: "Guest", email: null, phone: null, country: null },
      invoiceDate: new Date("2026-11-20T00:00:00Z"), checkIn: null, checkOut: null, nights: 0, issuedAt: new Date("2026-11-20T00:00:00Z"), status: "ISSUED" as const, paymentMethod: null, paidAt: null, paymentNote: null,
      invoiceLines: [{ id: "1", type: "CHARGE", description: "Laundry", calculation: "QUANTITY", quantity: 1, unitAmountNpr: 100, amountNpr: 100 }],
      roomLines: [], extraLines: [], subtotalNpr: 100, taxTotalNpr: 0, discountTotalNpr: 0, grandTotalNpr: 100,
    };
    const business = { name: "Resort", address: null, phones: [], emails: [], panVatNumber: null, invoiceFooterNote: null };
    const contact = { name: "Resort", address: "Bardiya", phone: null, whatsapp: "9779851000000", email: "b@example.test", websiteUrl: "https://example.test", mapsUrl: "https://maps.example.test/x" };
    const withFooter = renderInvoiceEmail(base, { ...business, contact }, null);
    expect(withFooter.html).toContain("https://wa.me/9779851000000");
    expect(withFooter.text).toContain("Website: https://example.test");
    expect(renderInvoiceEmail(base, business, null).html).not.toContain("wa.me");
  });
});
