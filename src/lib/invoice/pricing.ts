import { formatNpr } from "@/lib/money";

export type InvoiceRoomInput = {
  id: string;
  roomTypeName: string;
  roomName: string | null;
  standardRateNpr: number;
  childRateNpr: number;
  children: number;
  discountedRateNpr: number;
};

export type InvoiceAdjustmentInput = {
  id: string;
  type: "CHARGE" | "DISCOUNT";
  description: string;
  reference: string | null;
  quantity: number;
  unitAmountNpr: number;
  unitLabel?: string | null;
  sourceExtraId?: string | null;
};

export type InvoiceTaxInput =
  | { id: string; label: string; mode: "PERCENT"; percentage: number }
  | { id: string; label: string; mode: "FIXED"; amountNpr: number };

export type InvoiceRoomSnapshot = InvoiceRoomInput & {
  type: "ROOM";
  description: string;
  reference: null;
  ratePerNightNpr: number;
  nights: number;
  childChargeNpr: number;
  standardTotalNpr: number;
  amountNpr: number;
};

export type InvoiceAdjustmentSnapshot = {
  id: string;
  type: "CHARGE" | "DISCOUNT";
  description: string;
  reference: string | null;
  calculation: "QUANTITY";
  quantity: number;
  unitAmountNpr: number;
  unitLabel?: string | null;
  amountNpr: number;
  sourceExtraId?: string | null;
};

export type InvoiceTaxSnapshot = {
  id: string;
  label: string;
  mode: "PERCENT" | "FIXED";
  percentage: number | null;
  baseNpr: number;
  amountNpr: number;
};

export type InvoiceLineSnapshot = InvoiceRoomSnapshot | InvoiceAdjustmentSnapshot;
export type InvoiceExtraSnapshot = { id: string; name: string; unit: string; quantity: number; priceNpr: number; totalNpr: number };

export type InvoiceTotals = {
  roomLines: InvoiceRoomSnapshot[];
  extraLines: InvoiceExtraSnapshot[];
  invoiceLines: InvoiceLineSnapshot[];
  taxLines: InvoiceTaxSnapshot[];
  standardSubtotalNpr: number;
  subtotalNpr: number;
  discountTotalNpr: number;
  netNpr: number;
  taxTotalNpr: number;
  grandTotalNpr: number;
};

export type InvoiceTotalsRow = { kind: "subtotal" | "discount" | "net" | "tax" | "amountDue"; label: string; amountNpr: number };

const MAX_NPR_INT = 2_147_483_647;

function assertDatabaseInteger(value: number) {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_NPR_INT) throw new Error("Invoice amount is outside the supported whole-NPR range.");
  return value;
}

function assertRate(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_NPR_INT) throw new Error("Invoice rates must be nonnegative whole NPR amounts.");
  return value;
}

export function calculateInvoiceTotals(
  rooms: InvoiceRoomInput[],
  adjustments: InvoiceAdjustmentInput[],
  nights: number,
  options: { allowAboveStandard?: boolean; taxRows?: InvoiceTaxInput[] } = {},
): InvoiceTotals {
  if (!Number.isInteger(nights) || nights < 1) throw new Error("Invoice nights must be a positive whole number.");
  const roomLines = rooms.map((room): InvoiceRoomSnapshot => {
    [room.standardRateNpr, room.childRateNpr, room.discountedRateNpr].forEach(assertRate);
    if (!Number.isInteger(room.children) || room.children < 0) throw new Error("Invoice guest counts must be nonnegative whole numbers.");
    if (!options.allowAboveStandard && room.discountedRateNpr > room.standardRateNpr) throw new Error("Discounted rate cannot exceed the standard rate.");
    const childChargeNpr = assertDatabaseInteger(room.childRateNpr * room.children * nights);
    const standardTotalNpr = assertDatabaseInteger(room.standardRateNpr * nights + childChargeNpr);
    const amountNpr = assertDatabaseInteger(room.discountedRateNpr * nights + childChargeNpr);
    return {
      ...room, type: "ROOM", description: `${room.roomTypeName}${room.roomName ? ` · ${room.roomName}` : ""}`,
      reference: null, ratePerNightNpr: room.discountedRateNpr, nights, childChargeNpr, standardTotalNpr, amountNpr,
    };
  });

  const adjustmentLines = adjustments.map((line): InvoiceAdjustmentSnapshot => {
    assertRate(line.unitAmountNpr);
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) throw new Error("Line quantity must be greater than zero.");
    return {
      id: line.id, type: line.type, description: line.description.trim(), reference: line.reference?.trim() || null,
      calculation: "QUANTITY", quantity: line.quantity, unitAmountNpr: line.unitAmountNpr, unitLabel: line.unitLabel ?? null,
      amountNpr: assertDatabaseInteger(Math.round(line.quantity * line.unitAmountNpr)),
      ...(line.type === "CHARGE" && line.sourceExtraId ? { sourceExtraId: line.sourceExtraId } : {}),
    };
  });

  const roomAmount = roomLines.reduce((sum, line) => sum + line.amountNpr, 0);
  const standardSubtotalNpr = assertDatabaseInteger(roomLines.reduce((sum, line) => sum + line.standardTotalNpr, 0));
  const chargeAmount = adjustmentLines.filter((line) => line.type === "CHARGE").reduce((sum, line) => sum + line.amountNpr, 0);
  const subtotalNpr = assertDatabaseInteger(roomAmount + chargeAmount);
  const discountTotalNpr = assertDatabaseInteger(adjustmentLines.filter((line) => line.type === "DISCOUNT").reduce((sum, line) => sum + line.amountNpr, 0));
  const netNpr = assertDatabaseInteger(subtotalNpr - discountTotalNpr);
  if (netNpr < 0) throw new Error("Discounts cannot exceed the subtotal.");

  const taxLines = (options.taxRows ?? []).map((tax): InvoiceTaxSnapshot => {
    const label = tax.label.trim() || "Tax";
    if (tax.mode === "FIXED") {
      assertRate(tax.amountNpr);
      return { id: tax.id, label, mode: tax.mode, percentage: null, baseNpr: netNpr, amountNpr: tax.amountNpr };
    }
    if (!Number.isFinite(tax.percentage) || tax.percentage < 0 || tax.percentage > 100 || Math.abs(tax.percentage * 100 - Math.round(tax.percentage * 100)) >= 1e-8) {
      throw new Error("Tax percentage must be from 0 to 100 with up to 2 decimals.");
    }
    return { id: tax.id, label, mode: tax.mode, percentage: tax.percentage, baseNpr: netNpr, amountNpr: assertDatabaseInteger(Math.round(netNpr * tax.percentage / 100)) };
  });
  const taxTotalNpr = assertDatabaseInteger(taxLines.reduce((sum, tax) => sum + tax.amountNpr, 0));
  const grandTotalNpr = assertDatabaseInteger(netNpr + taxTotalNpr);

  const extraLines = adjustmentLines.flatMap((line): InvoiceExtraSnapshot[] => line.type === "CHARGE" && line.sourceExtraId
    ? [{ id: line.sourceExtraId, name: line.description, unit: line.unitLabel ?? "", quantity: line.quantity, priceNpr: line.unitAmountNpr, totalNpr: line.amountNpr }]
    : []);

  return {
    roomLines, extraLines, invoiceLines: [...roomLines, ...adjustmentLines], taxLines,
    standardSubtotalNpr, subtotalNpr, discountTotalNpr, netNpr, taxTotalNpr, grandTotalNpr,
  };
}

export function invoiceTotalsRows(totals: Pick<InvoiceTotals, "subtotalNpr" | "discountTotalNpr" | "netNpr" | "taxLines" | "grandTotalNpr">): InvoiceTotalsRow[] {
  return [
    { kind: "subtotal", label: "Subtotal (charges)", amountNpr: totals.subtotalNpr },
    { kind: "discount", label: "Discounts", amountNpr: -totals.discountTotalNpr },
    { kind: "net", label: "Net", amountNpr: totals.netNpr },
    ...totals.taxLines.map((tax) => ({
      kind: "tax" as const,
      label: tax.mode === "PERCENT" ? `${tax.label} ${tax.percentage}% on ${formatNpr(tax.baseNpr)} —` : `${tax.label} (fixed) on ${formatNpr(tax.baseNpr)} —`,
      amountNpr: tax.amountNpr,
    })),
    { kind: "amountDue", label: "Amount due", amountNpr: totals.grandTotalNpr },
  ];
}

export function invoiceNumber(year: number, sequence: number | bigint) {
  const value = Number(sequence);
  if (!Number.isInteger(year) || !Number.isSafeInteger(value) || year < 2000 || value < 1) throw new Error("Invalid invoice sequence values.");
  return `INV-${year}-${String(value).padStart(6, "0")}`;
}
