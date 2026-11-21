import { formatNpr } from "@/lib/money";
import type { InvoiceTaxSnapshot, InvoiceTotalsRow } from "./pricing";
import { invoiceTotalsRows } from "./pricing";

export type InvoiceDisplayLine = {
  id: string;
  type: "ROOM" | "CHARGE" | "DISCOUNT";
  description: string;
  reference: string | null;
  rateNpr: number;
  quantity: number;
  quantityLabel: string;
  amountNpr: number;
  included: boolean;
  standardRateNpr: number | null;
};

type LinesSource = { invoiceLines: unknown; roomLines: unknown; extraLines: unknown };

export function invoiceDisplayLines(source: LinesSource): InvoiceDisplayLine[] {
  const current = Array.isArray(source.invoiceLines) ? source.invoiceLines as Record<string, unknown>[] : [];
  if (current.length > 0) {
    return current.flatMap((line, index): InvoiceDisplayLine[] => {
      const type = line.type;
      if (type === "TAX") return [];
      const reference = typeof line.reference === "string" && line.reference.trim() ? line.reference : null;
      const description = `${String(line.description ?? "")}${reference ? ` · Ref: ${reference}` : ""}`;
      if (type === "ROOM") return [{
        id: String(line.id ?? `room-${index}`), type, description, reference,
        rateNpr: Number(line.ratePerNightNpr ?? line.discountedRateNpr ?? 0), quantity: Number(line.nights ?? 0), quantityLabel: "nights",
        amountNpr: Number(line.amountNpr ?? line.discountedTotalNpr ?? 0), included: false, standardRateNpr: Number(line.standardRateNpr ?? 0),
      }];
      if (type !== "CHARGE" && type !== "DISCOUNT") return [];
      const quantity = Number(line.quantity ?? 0);
      const unit = typeof line.unitLabel === "string" && line.unitLabel ? line.unitLabel : "";
      const amountNpr = Number(line.amountNpr ?? 0);
      return [{
        id: String(line.id ?? `line-${index}`), type, description, reference,
        rateNpr: Number(line.unitAmountNpr ?? 0), quantity, quantityLabel: unit,
        amountNpr, included: type === "CHARGE" && Boolean(line.sourceExtraId) && amountNpr === 0, standardRateNpr: null,
      }];
    });
  }

  const rooms = Array.isArray(source.roomLines) ? source.roomLines as Record<string, unknown>[] : [];
  const extras = Array.isArray(source.extraLines) ? source.extraLines as Record<string, unknown>[] : [];
  return [
    ...rooms.map((line, index): InvoiceDisplayLine => ({
      id: `legacy-room-${index}`, type: "ROOM", description: `${String(line.roomTypeName ?? "Room")}${line.roomName ? ` · ${String(line.roomName)}` : ""}`,
      reference: null, rateNpr: Number(line.discountedRateNpr ?? 0), quantity: Number(line.nights ?? 0), quantityLabel: "nights",
      amountNpr: Number(line.discountedTotalNpr ?? 0), included: false, standardRateNpr: Number(line.standardRateNpr ?? 0),
    })),
    ...extras.map((line, index): InvoiceDisplayLine => ({
      id: `legacy-extra-${index}`, type: "CHARGE", description: String(line.name ?? "Extra"), reference: null,
      rateNpr: Number(line.priceNpr ?? 0), quantity: Number(line.quantity ?? 0), quantityLabel: String(line.unit ?? ""),
      amountNpr: Number(line.totalNpr ?? 0), included: Number(line.totalNpr ?? 0) === 0, standardRateNpr: null,
    })),
  ];
}

export type InvoiceTotalsView = {
  subtotalNpr: number;
  discountTotalNpr: number;
  netNpr: number;
  taxLines: InvoiceTaxSnapshot[];
  grandTotalNpr: number;
};

type TotalsSource = {
  invoiceLines: unknown;
  taxLines?: unknown;
  subtotalNpr: number;
  taxTotalNpr: number;
  discountTotalNpr: number;
  grandTotalNpr: number;
};

export function invoiceDisplayTotals(invoice: TotalsSource): InvoiceTotalsView {
  const current = Array.isArray(invoice.taxLines) ? invoice.taxLines as Record<string, unknown>[] : [];
  const legacyLineTaxes = Array.isArray(invoice.invoiceLines)
    ? (invoice.invoiceLines as Record<string, unknown>[]).filter((line) => line.type === "TAX")
    : [];
  const legacyTaxTotal = legacyLineTaxes.reduce((sum, line) => sum + Number(line.amountNpr ?? 0), 0);
  const subtotalNpr = invoice.subtotalNpr || invoice.grandTotalNpr + invoice.discountTotalNpr - legacyTaxTotal;
  const rawTaxes = current.length > 0 ? current : legacyLineTaxes.map((line, index) => ({
    id: line.id ?? `legacy-tax-${index}`,
    label: line.description ?? "Tax",
    mode: line.calculation === "PERCENT" ? "PERCENT" : "FIXED",
    percentage: line.percentage ?? null,
    baseNpr: subtotalNpr,
    amountNpr: line.amountNpr ?? 0,
  }));
  const taxLines = rawTaxes.map((tax, index): InvoiceTaxSnapshot => ({
    id: String(tax.id ?? `tax-${index}`), label: String(tax.label ?? "Tax"),
    mode: tax.mode === "PERCENT" ? "PERCENT" : "FIXED", percentage: tax.mode === "PERCENT" ? Number(tax.percentage ?? 0) : null,
    baseNpr: Number(tax.baseNpr ?? invoice.subtotalNpr), amountNpr: Number(tax.amountNpr ?? 0),
  }));
  const netNpr = subtotalNpr - invoice.discountTotalNpr;
  return { subtotalNpr, discountTotalNpr: invoice.discountTotalNpr, netNpr, taxLines, grandTotalNpr: invoice.grandTotalNpr };
}

export function invoiceDisplayTotalsRows(invoice: TotalsSource): InvoiceTotalsRow[] {
  return invoiceTotalsRows(invoiceDisplayTotals(invoice));
}

export function taxRowAmountLabel(row: InvoiceTaxSnapshot) {
  return `${row.label}${row.mode === "PERCENT" ? ` ${row.percentage}%` : " (fixed)"} on ${formatNpr(row.baseNpr)} — ${formatNpr(row.amountNpr)}`;
}
