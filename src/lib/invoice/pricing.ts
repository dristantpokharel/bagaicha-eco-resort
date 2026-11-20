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
} | {
  id: string;
  type: "TAX";
  description: string;
  reference: string | null;
  calculation: "QUANTITY" | "PERCENT" | "FIXED";
  quantity?: number;
  unitAmountNpr?: number;
  unitLabel?: string | null;
  percentage?: number | null;
  amountNpr?: number | null;
};

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
  type: "CHARGE" | "TAX" | "DISCOUNT";
  description: string;
  reference: string | null;
  calculation: "QUANTITY" | "PERCENT" | "FIXED";
  quantity?: number;
  unitAmountNpr?: number;
  unitLabel?: string | null;
  percentage?: number;
  enteredAmountNpr?: number;
  amountNpr: number;
  sourceExtraId?: string | null;
};

export type InvoiceLineSnapshot = InvoiceRoomSnapshot | InvoiceAdjustmentSnapshot;
export type InvoiceExtraSnapshot = { id: string; name: string; unit: string; quantity: number; priceNpr: number; totalNpr: number };

export type InvoiceTotals = {
  roomLines: InvoiceRoomSnapshot[];
  extraLines: InvoiceExtraSnapshot[];
  invoiceLines: InvoiceLineSnapshot[];
  standardSubtotalNpr: number;
  subtotalNpr: number;
  taxTotalNpr: number;
  discountTotalNpr: number;
  grandTotalNpr: number;
};

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
  options: { allowAboveStandard?: boolean } = {},
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
      ...room,
      type: "ROOM",
      description: `${room.roomTypeName}${room.roomName ? ` · ${room.roomName}` : ""}`,
      reference: null,
      ratePerNightNpr: room.discountedRateNpr,
      nights,
      childChargeNpr,
      standardTotalNpr,
      amountNpr,
    };
  });

  const roomAmount = roomLines.reduce((sum, line) => sum + line.amountNpr, 0);
  const standardSubtotalNpr = assertDatabaseInteger(roomLines.reduce((sum, line) => sum + line.standardTotalNpr, 0));
  const preliminary = adjustments.map((line): InvoiceAdjustmentSnapshot => {
    const common = { id: line.id, type: line.type, description: line.description.trim(), reference: line.reference?.trim() || null };
    if (line.type === "CHARGE" || line.type === "DISCOUNT") {
      assertRate(line.unitAmountNpr);
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) throw new Error("Line quantity must be greater than zero.");
      const amountNpr = assertDatabaseInteger(Math.round(line.quantity * line.unitAmountNpr));
      if (line.type === "CHARGE") {
        return { ...common, calculation: "QUANTITY", quantity: line.quantity, unitAmountNpr: line.unitAmountNpr, unitLabel: line.unitLabel ?? null, amountNpr, sourceExtraId: line.sourceExtraId ?? null };
      }
      return { ...common, calculation: "QUANTITY", quantity: line.quantity, unitAmountNpr: line.unitAmountNpr, unitLabel: line.unitLabel ?? null, amountNpr };
    }
    if (line.type !== "TAX") throw new Error("Unsupported invoice line type.");
    if (line.calculation === "QUANTITY") {
      const unitAmountNpr = line.unitAmountNpr ?? 0;
      const quantity = line.quantity ?? 0;
      assertRate(unitAmountNpr);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Line quantity must be greater than zero.");
      return { ...common, calculation: "QUANTITY", quantity, unitAmountNpr, unitLabel: line.unitLabel ?? null, amountNpr: assertDatabaseInteger(Math.round(quantity * unitAmountNpr)) };
    }
    if (line.calculation === "FIXED") {
      const enteredAmountNpr = line.amountNpr ?? 0;
      assertRate(enteredAmountNpr);
      return { ...common, calculation: "FIXED", enteredAmountNpr, amountNpr: enteredAmountNpr };
    }
    const percentage = line.percentage ?? 0;
    if (!Number.isFinite(percentage) || percentage < 0) throw new Error("Tax percentage must be a nonnegative number.");
    return { ...common, calculation: "PERCENT", percentage, amountNpr: 0 };
  });

  const subtotalNpr = assertDatabaseInteger(roomAmount + preliminary.filter((line) => line.type === "CHARGE").reduce((sum, line) => sum + line.amountNpr, 0));
  const invoiceLines = preliminary.map((line, index): InvoiceAdjustmentSnapshot => {
    const source = adjustments[index];
    if (source.type === "TAX" && line.type === "TAX" && line.calculation === "PERCENT") {
      const percentage = line.percentage ?? 0;
      return { ...line, calculation: "PERCENT", percentage, amountNpr: assertDatabaseInteger(Math.round(subtotalNpr * percentage / 100)) };
    }
    return line;
  });
  const taxTotalNpr = assertDatabaseInteger(invoiceLines.filter((line) => line.type === "TAX").reduce((sum, line) => sum + line.amountNpr, 0));
  const discountTotalNpr = assertDatabaseInteger(invoiceLines.filter((line) => line.type === "DISCOUNT").reduce((sum, line) => sum + line.amountNpr, 0));
  const grandTotalNpr = assertDatabaseInteger(subtotalNpr + taxTotalNpr - discountTotalNpr);
  if (grandTotalNpr < 0) throw new Error("Discounts cannot exceed the subtotal and tax amounts.");

  const extraLines = invoiceLines.flatMap((line): InvoiceExtraSnapshot[] => {
    if (line.type !== "CHARGE" || !line.sourceExtraId) return [];
    return [{ id: line.sourceExtraId, name: line.description, unit: line.unitLabel ?? "", quantity: line.quantity ?? 1, priceNpr: line.unitAmountNpr ?? 0, totalNpr: line.amountNpr }];
  });

  return {
    roomLines,
    extraLines,
    invoiceLines: [...roomLines, ...invoiceLines],
    standardSubtotalNpr,
    subtotalNpr,
    taxTotalNpr,
    discountTotalNpr,
    grandTotalNpr,
  };
}

export function invoiceNumber(year: number, sequence: number | bigint) {
  const value = Number(sequence);
  if (!Number.isInteger(year) || !Number.isSafeInteger(value) || year < 2000 || value < 1) throw new Error("Invalid invoice sequence values.");
  return `INV-${year}-${String(value).padStart(6, "0")}`;
}
