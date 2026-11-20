import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { issueInvoice, markInvoicePaid, voidInvoice } from "./service";

function setup(statuses: string[] = ["CONFIRMED", "CANCELLED", "PENDING"]) {
  const reservation = {
    id: "r1", reference: "BG-2026-000001", guestName: "Guest Snapshot", guestEmail: "guest@example.test", guestPhone: "9800000000", guestCountry: "Nepal",
    checkIn: new Date("2026-12-01T00:00:00.000Z"), checkOut: new Date("2026-12-03T00:00:00.000Z"),
    bookings: statuses.map((status, index) => ({
      id: `b${index + 1}`, status, pricePerNightNpr: 3000, childPricePerNightNpr: 500, children: 1,
      roomType: { name: `Type ${index + 1}` }, room: null,
      extras: index === 0 ? [{ id: "e1", quantity: 1, item: { name: "Blanket", unit: "pcs" } }] : [],
    })),
  };
  const tx = {
    reservation: { findUnique: vi.fn(async () => reservation) },
    invoice: {
      create: vi.fn(async ({ data }: { data: unknown }) => ({ id: "i1", ...data as object })),
      findUnique: vi.fn(async () => ({ id: "i1", number: "INV-2026-000007", status: "ISSUED" })),
      update: vi.fn(async ({ data }: { data: unknown }) => ({ id: "i1", ...data as object })),
    },
    activityLog: { create: vi.fn(async () => ({ id: "log1" })) },
    $queryRaw: vi.fn(async () => [{ value: BigInt(7) }]),
  };
  return { reservation, tx: tx as unknown as Prisma.TransactionClient };
}

describe("invoice issuance snapshots", () => {
  it("copies only confirmed, checked-in, and checked-out lines from saved booking rates", async () => {
    const { reservation, tx } = setup();
    const result = await issueInvoice(tx, {
      reservationId: "r1", userId: "u1", roomRates: { b1: 2500 }, adjustmentLines: [{ id: "booking-extra-e1", type: "CHARGE", description: "Blanket", reference: null, quantity: 1, unitAmountNpr: 0, sourceExtraId: "e1" }], allowAboveStandard: false,
      now: new Date("2026-11-17T18:30:00.000Z"),
    });
    expect(result.number).toBe("INV-2026-000007");
    const created = (tx.invoice.create as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(created.reservationRef).toBe("BG-2026-000001");
    expect(created.guestSnapshot.name).toBe("Guest Snapshot");
    expect(created.roomLines).toHaveLength(1);
    expect(created.roomLines[0]).toMatchObject({ standardRateNpr: 3000, discountedRateNpr: 2500, childChargeNpr: 1000 });
    expect(created.extraLines[0]).toMatchObject({ name: "Blanket", totalNpr: 0 });
    expect(created.invoiceLines[1]).toMatchObject({ type: "CHARGE", description: "Blanket", amountNpr: 0 });
    reservation.guestName = "Changed later";
    reservation.bookings[0].pricePerNightNpr = 9000;
    expect(created.guestSnapshot.name).toBe("Guest Snapshot");
    expect(created.roomLines[0].standardRateNpr).toBe(3000);
  });

  it("refuses reservations with no eligible room lines", async () => {
    const { tx } = setup(["PENDING", "CANCELLED"]);
    await expect(issueInvoice(tx, { reservationId: "r1", userId: "u1", roomRates: {}, adjustmentLines: [], allowAboveStandard: false })).rejects.toThrow(/no confirmed/);
    expect(tx.invoice.create).not.toHaveBeenCalled();
  });

  it("enforces the standard rate unless explicitly allowed", async () => {
    const { tx } = setup(["CHECKED_OUT"]);
    await expect(issueInvoice(tx, { reservationId: "r1", userId: "u1", roomRates: { b1: 3500 }, adjustmentLines: [], allowAboveStandard: false })).rejects.toThrow(/cannot exceed/);
    const allowed = setup(["CHECKED_OUT"]);
    await expect(issueInvoice(allowed.tx, { reservationId: "r1", userId: "u1", roomRates: { b1: 3500 }, adjustmentLines: [], allowAboveStandard: true })).resolves.toBeTruthy();
  });

  it("uses Kathmandu local year for invoice numbering near New Year", async () => {
    const { tx } = setup(["CONFIRMED"]);
    const result = await issueInvoice(tx, {
      reservationId: "r1", userId: "u1", roomRates: { b1: 3000 }, adjustmentLines: [], allowAboveStandard: false,
      now: new Date("2026-12-31T18:30:00.000Z"),
    });
    expect(result.number).toBe("INV-2027-000007");
  });
});

describe("invoice payment and void rules", () => {
  it("marks only ISSUED invoices paid and audits the change", async () => {
    const { tx } = setup();
    await markInvoicePaid(tx, { invoiceId: "i1", userId: "u1", paymentMethod: "CASH", paidAt: new Date("2026-11-17T00:00:00Z"), note: "" });
    expect(tx.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PAID", paymentMethod: "CASH" }) }));
    expect(tx.activityLog.create).toHaveBeenCalled();
  });

  it("requires Admin+ to void paid invoices and records a reason for allowed voids", async () => {
    const paidTx = setup().tx;
    (paidTx.invoice.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "i1", number: "INV-2026-000007", status: "PAID" });
    await expect(voidInvoice(paidTx, { invoiceId: "i1", userId: "staff", reason: "Correction", allowPaid: false })).rejects.toThrow(/Admin\+/);
    await voidInvoice(paidTx, { invoiceId: "i1", userId: "admin", reason: "Correction", allowPaid: true });
    expect(paidTx.invoice.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "VOID", voidReason: "Correction" }) }));
  });
});
