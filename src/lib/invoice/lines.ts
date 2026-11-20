import { formatNpr } from "@/lib/money";

export type InvoiceDisplayLine = {
  id: string;
  type: "ROOM" | "CHARGE" | "TAX" | "DISCOUNT";
  description: string;
  reference: string | null;
  ratePerNightNpr: number | null;
  standardRateNpr: number | null;
  nights: number | null;
  amountNpr: number;
  included: boolean;
};

type LinesSource = { invoiceLines: unknown; roomLines: unknown; extraLines: unknown };

export function invoiceDisplayLines(source: LinesSource): InvoiceDisplayLine[] {
  const current = Array.isArray(source.invoiceLines) ? source.invoiceLines as Record<string, unknown>[] : [];
  if (current.length > 0) {
    return current.map((line, index) => {
      const type = line.type as InvoiceDisplayLine["type"];
      const baseDescription = String(line.description ?? "");
      const reference = typeof line.reference === "string" && line.reference.trim() ? line.reference : null;
      const referenceText = reference ? ` · Ref: ${reference}` : "";
      if (type === "ROOM") {
        const children = Number(line.children ?? 0);
        const childCharge = Number(line.childChargeNpr ?? 0);
        const childDetails = children > 0 ? ` · ${children} child${children === 1 ? "" : "ren"}, child charge ${formatNpr(childCharge)}` : "";
        return {
          id: String(line.id ?? `room-${index}`), type, description: `${baseDescription}${childDetails}${referenceText}`,
          reference, ratePerNightNpr: Number(line.ratePerNightNpr ?? line.discountedRateNpr ?? 0),
          standardRateNpr: Number(line.standardRateNpr ?? 0), nights: Number(line.nights ?? 0), amountNpr: Number(line.amountNpr ?? 0), included: false,
        };
      }
      const quantity = Number(line.quantity ?? 0);
      const unitLabel = typeof line.unitLabel === "string" && line.unitLabel ? ` ${line.unitLabel}` : "";
      let detail = baseDescription;
      if ((type === "CHARGE" || type === "DISCOUNT") && line.calculation === "QUANTITY") {
        detail += ` · ${quantity}${unitLabel} × ${formatNpr(Number(line.unitAmountNpr ?? 0))}`;
      } else if (type === "TAX" && line.calculation === "PERCENT") {
        detail += ` · ${Number(line.percentage ?? 0)}% of subtotal`;
      }
      const amountNpr = Number(line.amountNpr ?? 0);
      return {
        id: String(line.id ?? `line-${index}`), type, description: `${detail}${referenceText}`, reference,
        ratePerNightNpr: null, standardRateNpr: null, nights: null, amountNpr,
        included: type === "CHARGE" && Boolean(line.sourceExtraId) && amountNpr === 0,
      };
    });
  }

  const rooms = Array.isArray(source.roomLines) ? source.roomLines as Record<string, unknown>[] : [];
  const extras = Array.isArray(source.extraLines) ? source.extraLines as Record<string, unknown>[] : [];
  return [
    ...rooms.map((line, index): InvoiceDisplayLine => ({
      id: `legacy-room-${index}`, type: "ROOM", description: `${String(line.roomTypeName ?? "Room")}${line.roomName ? ` · ${String(line.roomName)}` : ""}`,
      reference: null, ratePerNightNpr: Number(line.discountedRateNpr ?? 0), standardRateNpr: Number(line.standardRateNpr ?? 0),
      nights: Number(line.nights ?? 0), amountNpr: Number(line.discountedTotalNpr ?? 0), included: false,
    })),
    ...extras.map((line, index): InvoiceDisplayLine => ({
      id: `legacy-extra-${index}`, type: "CHARGE", description: `${String(line.quantity ?? "")} ${String(line.unit ?? "")} · ${String(line.name ?? "Extra")}`,
      reference: null, ratePerNightNpr: null, standardRateNpr: null, nights: null, amountNpr: Number(line.totalNpr ?? 0), included: Number(line.totalNpr ?? 0) === 0,
    })),
  ];
}

export function invoiceDisplayTotals(invoice: { invoiceLines: unknown; subtotalNpr: number; taxTotalNpr: number; discountTotalNpr: number; grandTotalNpr: number }) {
  const hasCurrentLines = Array.isArray(invoice.invoiceLines) && invoice.invoiceLines.length > 0;
  return {
    subtotalNpr: hasCurrentLines ? invoice.subtotalNpr : invoice.grandTotalNpr,
    taxTotalNpr: hasCurrentLines ? invoice.taxTotalNpr : 0,
    discountTotalNpr: hasCurrentLines ? invoice.discountTotalNpr : 0,
    amountDueNpr: invoice.grandTotalNpr,
  };
}
