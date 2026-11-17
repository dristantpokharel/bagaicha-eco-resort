export type InvoiceRoomInput = {
  id: string;
  roomTypeName: string;
  roomName: string | null;
  standardRateNpr: number;
  childRateNpr: number;
  children: number;
  discountedRateNpr: number;
};

export type InvoiceExtraInput = { id: string; name: string; unit: string; quantity: number; priceNpr: number };

export type InvoiceRoomSnapshot = InvoiceRoomInput & {
  nights: number;
  childChargeNpr: number;
  standardTotalNpr: number;
  discountedTotalNpr: number;
  discountNpr: number;
};

export type InvoiceExtraSnapshot = InvoiceExtraInput & { totalNpr: number };

export type InvoiceTotals = {
  roomLines: InvoiceRoomSnapshot[];
  extraLines: InvoiceExtraSnapshot[];
  standardSubtotalNpr: number;
  discountTotalNpr: number;
  grandTotalNpr: number;
};

const MAX_NPR_INT = 2_147_483_647;

function assertDatabaseInteger(value: number) {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_NPR_INT) throw new Error("Invoice amount is outside the supported whole-NPR range.");
  return value;
}

export function calculateInvoiceTotals(rooms: InvoiceRoomInput[], extras: InvoiceExtraInput[], nights: number, options: { allowAboveStandard?: boolean } = {}): InvoiceTotals {
  if (!Number.isInteger(nights) || nights < 1) throw new Error("Invoice nights must be a positive whole number.");
  const roomLines = rooms.map((room) => {
    const values = [room.standardRateNpr, room.childRateNpr, room.children, room.discountedRateNpr];
    if (values.some((value) => !Number.isSafeInteger(value) || value < 0 || value > MAX_NPR_INT)) throw new Error("Invoice rates and guest counts must be nonnegative whole numbers.");
    if (!options.allowAboveStandard && room.discountedRateNpr > room.standardRateNpr) throw new Error("Discounted rate cannot exceed the standard rate.");
    const childChargeNpr = assertDatabaseInteger(room.childRateNpr * room.children * nights);
    const standardTotalNpr = assertDatabaseInteger(room.standardRateNpr * nights + childChargeNpr);
    const discountedTotalNpr = assertDatabaseInteger(room.discountedRateNpr * nights + childChargeNpr);
    return { ...room, nights, childChargeNpr, standardTotalNpr, discountedTotalNpr, discountNpr: assertDatabaseInteger((room.standardRateNpr - room.discountedRateNpr) * nights) };
  });
  const extraLines = extras.map((extra) => {
    if (!Number.isSafeInteger(extra.priceNpr) || extra.priceNpr < 0 || !Number.isFinite(extra.quantity) || extra.quantity <= 0) {
      throw new Error("Extra prices and quantities must be valid nonnegative amounts.");
    }
    return { ...extra, totalNpr: assertDatabaseInteger(extra.priceNpr) };
  });
  const standardSubtotalNpr = assertDatabaseInteger(roomLines.reduce((sum, line) => sum + line.standardTotalNpr, 0));
  const discountTotalNpr = assertDatabaseInteger(roomLines.reduce((sum, line) => sum + line.discountNpr, 0));
  const grandTotalNpr = assertDatabaseInteger(roomLines.reduce((sum, line) => sum + line.discountedTotalNpr, 0) + extraLines.reduce((sum, line) => sum + line.totalNpr, 0));
  return { roomLines, extraLines, standardSubtotalNpr, discountTotalNpr, grandTotalNpr };
}

export function invoiceNumber(year: number, sequence: number | bigint) {
  const value = Number(sequence);
  if (!Number.isInteger(year) || !Number.isSafeInteger(value) || year < 2000 || value < 1) throw new Error("Invalid invoice sequence values.");
  return `INV-${year}-${String(value).padStart(6, "0")}`;
}
