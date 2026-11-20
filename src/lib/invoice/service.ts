import { formatInTimeZone } from "date-fns-tz";
import { Prisma } from "@/generated/prisma/client";
import type { InvoicePaymentMethod } from "@/generated/prisma/enums";
import { logActivity } from "@/lib/activity-log";
import { nightsBetween } from "@/lib/booking/dates";
import { calculateInvoiceTotals, invoiceNumber } from "./pricing";
import type { InvoiceAdjustmentInput, InvoiceRoomInput } from "./pricing";

export const BILLABLE_BOOKING_STATUSES = ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] as const;

export class InvoiceRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceRuleError";
  }
}

export async function issueInvoice(
  tx: Prisma.TransactionClient,
  input: {
    reservationId: string;
    userId: string;
    roomRates: Record<string, number>;
    adjustmentLines: InvoiceAdjustmentInput[];
    allowAboveStandard: boolean;
    now?: Date;
  },
) {
  const reservation = await tx.reservation.findUnique({
    where: { id: input.reservationId },
    include: {
      bookings: {
        include: {
          roomType: { select: { name: true } },
          room: { select: { name: true } },
          extras: { include: { item: { select: { name: true, unit: true } } }, orderBy: { createdAt: "asc" } },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });
  if (!reservation) throw new InvoiceRuleError("Reservation not found.");
  const eligible = reservation.bookings.filter((booking) => (BILLABLE_BOOKING_STATUSES as readonly string[]).includes(booking.status));
  if (eligible.length === 0) {
    throw new InvoiceRuleError("This reservation has no confirmed, checked-in, or checked-out rooms to invoice. Pending or cancelled rooms are not invoiced.");
  }
  if (eligible.some((booking) => input.roomRates[booking.id] === undefined)) throw new InvoiceRuleError("Enter a discounted rate for every billable room.");
  const extrasById = new Map(eligible.flatMap((booking) => booking.extras.map((extra) => [extra.id, extra] as const)));
  const selectedExtras = input.adjustmentLines.flatMap((line) => line.type === "CHARGE" && line.sourceExtraId ? [line.sourceExtraId] : []);
  for (const id of selectedExtras) if (!extrasById.has(id)) throw new InvoiceRuleError("A booking extra no longer belongs to an invoiceable room.");

  const nights = nightsBetween(reservation.checkIn, reservation.checkOut);
  const rooms: InvoiceRoomInput[] = eligible.map((booking) => {
    const discountedRateNpr = input.roomRates[booking.id];
    if (!input.allowAboveStandard && discountedRateNpr > booking.pricePerNightNpr) {
      throw new InvoiceRuleError(`Discounted rate for ${booking.roomType.name} cannot exceed its standard rate without Admin+ approval.`);
    }
    return {
      id: booking.id,
      roomTypeName: booking.roomType.name,
      roomName: booking.room?.name ?? null,
      standardRateNpr: booking.pricePerNightNpr,
      childRateNpr: booking.childPricePerNightNpr,
      children: booking.children,
      discountedRateNpr,
    };
  });
  const adjustments: InvoiceAdjustmentInput[] = input.adjustmentLines.map((line) => {
    if (line.type === "CHARGE" && line.sourceExtraId) {
      const extra = extrasById.get(line.sourceExtraId)!;
      return { ...line, description: extra.item.name, quantity: Number(extra.quantity), unitLabel: extra.item.unit };
    }
    return line;
  });
  const totals = calculateInvoiceTotals(rooms, adjustments, nights, { allowAboveStandard: input.allowAboveStandard });
  const now = input.now ?? new Date();
  const year = Number(formatInTimeZone(now, "Asia/Kathmandu", "yyyy"));
  const sequence = await tx.$queryRaw<{ value: bigint }[]>`SELECT nextval('invoice_number_seq') AS value`;
  const number = invoiceNumber(year, sequence[0].value);

  const guestSnapshot = {
    name: reservation.guestName,
    email: reservation.guestEmail,
    phone: reservation.guestPhone,
    country: reservation.guestCountry,
  };
  const created = await tx.invoice.create({
    data: {
      number,
      reservationId: reservation.id,
      reservationRef: reservation.reference,
      guestSnapshot,
      invoiceDate: new Date(`${formatInTimeZone(now, "Asia/Kathmandu", "yyyy-MM-dd")}T00:00:00.000Z`),
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      nights,
      roomLines: totals.roomLines as unknown as Prisma.InputJsonValue,
      extraLines: totals.extraLines as unknown as Prisma.InputJsonValue,
      invoiceLines: totals.invoiceLines as unknown as Prisma.InputJsonValue,
      standardSubtotalNpr: totals.standardSubtotalNpr,
      discountTotalNpr: totals.discountTotalNpr,
      subtotalNpr: totals.subtotalNpr,
      taxTotalNpr: totals.taxTotalNpr,
      grandTotalNpr: totals.grandTotalNpr,
      issuedById: input.userId,
      issuedAt: now,
    },
  });
  await logActivity(tx, {
    userId: input.userId,
    action: "invoice.issued",
    entityType: "Invoice",
    entityId: created.id,
    details: { number, reservationRef: reservation.reference, amountDueNpr: totals.grandTotalNpr },
  });
  return created;
}

export async function issueStandaloneInvoice(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    name: string;
    phone: string;
    email: string | null;
    address: string | null;
    invoiceDate: Date;
    checkIn: Date | null;
    checkOut: Date | null;
    referenceNote: string | null;
    saveAsGuest: boolean;
    lines: Array<{ id: string; type: "CHARGE" | "TAX" | "DISCOUNT"; description: string; reference: string; quantity: number; unitAmountNpr: number }>;
    now?: Date;
  },
) {
  if (input.saveAsGuest) {
    await tx.guest.create({ data: { name: input.name, phone: input.phone, email: input.email, notes: input.address ? `Invoice address: ${input.address}` : null } });
  }
  const nights = input.checkIn && input.checkOut ? nightsBetween(input.checkIn, input.checkOut) : 1;
  const adjustments: InvoiceAdjustmentInput[] = input.lines.map((line) => {
    const base = { id: line.id, description: line.description, reference: line.reference || null, quantity: line.quantity, unitAmountNpr: line.unitAmountNpr, unitLabel: null };
    if (line.type === "CHARGE") return { ...base, type: "CHARGE" };
    if (line.type === "DISCOUNT") return { ...base, type: "DISCOUNT" };
    return { ...base, type: "TAX", calculation: "QUANTITY" };
  });
  const totals = calculateInvoiceTotals([], adjustments, nights);
  const now = input.now ?? new Date();
  const year = Number(formatInTimeZone(now, "Asia/Kathmandu", "yyyy"));
  const sequence = await tx.$queryRaw<{ value: bigint }[]>`SELECT nextval('invoice_number_seq') AS value`;
  const number = invoiceNumber(year, sequence[0].value);
  const guestSnapshot = { name: input.name.trim(), email: input.email, phone: input.phone.trim(), country: null, address: input.address, referenceNote: input.referenceNote };
  const created = await tx.invoice.create({
    data: {
      number,
      reservationId: null,
      reservationRef: null,
      guestSnapshot,
      invoiceDate: input.invoiceDate,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nights: input.checkIn && input.checkOut ? nights : null,
      roomLines: [] as unknown as Prisma.InputJsonValue,
      extraLines: [] as unknown as Prisma.InputJsonValue,
      invoiceLines: totals.invoiceLines as unknown as Prisma.InputJsonValue,
      standardSubtotalNpr: 0,
      discountTotalNpr: totals.discountTotalNpr,
      subtotalNpr: totals.subtotalNpr,
      taxTotalNpr: totals.taxTotalNpr,
      grandTotalNpr: totals.grandTotalNpr,
      issuedById: input.userId,
      issuedAt: now,
    },
  });
  await logActivity(tx, { userId: input.userId, action: "invoice.issued_standalone", entityType: "Invoice", entityId: created.id, details: { number, amountDueNpr: totals.grandTotalNpr, lineCount: input.lines.length } });
  return created;
}

export async function linkStandaloneInvoice(
  tx: Prisma.TransactionClient,
  input: { invoiceId: string; reservationId: string; userId: string },
) {
  const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice) throw new InvoiceRuleError("Invoice not found.");
  if (invoice.reservationId || invoice.status !== "ISSUED" || invoice.linkedReservationId) throw new InvoiceRuleError("Only an unlinked ISSUED standalone invoice can be linked.");
  const reservation = await tx.reservation.findUnique({ where: { id: input.reservationId }, select: { id: true, reference: true } });
  if (!reservation) throw new InvoiceRuleError("Reservation not found.");
  const saved = await tx.invoice.update({ where: { id: invoice.id }, data: { linkedReservationId: reservation.id } });
  await logActivity(tx, { userId: input.userId, action: "invoice.linked_reservation", entityType: "Invoice", entityId: invoice.id, details: { number: invoice.number, reservationRef: reservation.reference } });
  return saved;
}

export async function markInvoicePaid(
  tx: Prisma.TransactionClient,
  input: { invoiceId: string; userId: string; paymentMethod: InvoicePaymentMethod; paidAt: Date; note: string },
) {
  const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice) throw new InvoiceRuleError("Invoice not found.");
  if (invoice.status !== "ISSUED") throw new InvoiceRuleError("Only an issued invoice can be marked as paid.");
  const saved = await tx.invoice.update({
    where: { id: invoice.id },
    data: { status: "PAID", paymentMethod: input.paymentMethod, paidAt: input.paidAt, paymentNote: input.note || null },
  });
  await logActivity(tx, { userId: input.userId, action: "invoice.paid", entityType: "Invoice", entityId: invoice.id, details: { number: invoice.number, paymentMethod: input.paymentMethod, paidAt: input.paidAt.toISOString() } });
  return saved;
}

export async function voidInvoice(
  tx: Prisma.TransactionClient,
  input: { invoiceId: string; userId: string; reason: string; allowPaid: boolean; now?: Date },
) {
  const invoice = await tx.invoice.findUnique({ where: { id: input.invoiceId } });
  if (!invoice) throw new InvoiceRuleError("Invoice not found.");
  if (invoice.status === "VOID") throw new InvoiceRuleError("This invoice is already void.");
  if (invoice.status === "PAID" && !input.allowPaid) throw new InvoiceRuleError("Only Admin+ can void a paid invoice.");
  const now = input.now ?? new Date();
  const saved = await tx.invoice.update({
    where: { id: invoice.id },
    data: { status: "VOID", voidedAt: now, voidReason: input.reason.trim(), voidedById: input.userId },
  });
  await logActivity(tx, { userId: input.userId, action: "invoice.voided", entityType: "Invoice", entityId: invoice.id, details: { number: invoice.number, reason: input.reason.trim() } });
  return saved;
}
