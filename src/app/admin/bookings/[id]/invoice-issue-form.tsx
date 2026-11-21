"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormMessage, Input, Select } from "@/components/ui/form";
import { formatNpr } from "@/lib/money";
import type { ActionResult } from "@/lib/actions";
import { calculateInvoiceTotals, invoiceTotalsRows, type InvoiceAdjustmentInput, type InvoiceTaxInput } from "@/lib/invoice/pricing";
import { invoiceIssuedHref } from "@/lib/invoice/navigation";
import { issueInvoiceAction } from "../../invoices/actions";

export type IssueRoom = { id: string; name: string; roomName: string | null; standardRateNpr: number; childRateNpr: number; children: number };
export type IssueExtra = { id: string; name: string; unit: string; quantity: number };
type AdjustmentDraft = { id: string; type: "CHARGE" | "DISCOUNT"; description: string; reference: string; quantity: string; unitAmountNpr: string; unitLabel: string; sourceExtraId?: string };
type TaxDraft = { id: string; label: string; mode: "PERCENT" | "FIXED"; percentage: string; amountNpr: string };

const adjustmentFromExtra = (extra: IssueExtra): AdjustmentDraft => ({ id: `booking-extra-${extra.id}`, type: "CHARGE", description: extra.name, reference: "", quantity: String(extra.quantity), unitAmountNpr: "0", unitLabel: extra.unit, sourceExtraId: extra.id });
const serializeAdjustment = (line: AdjustmentDraft) => ({ ...line, quantity: Number(line.quantity), unitAmountNpr: Number(line.unitAmountNpr) });
const serializeTax = (line: TaxDraft) => line.mode === "PERCENT"
  ? { id: line.id, label: line.label, mode: line.mode, percentage: Number(line.percentage || 0) }
  : { id: line.id, label: line.label, mode: line.mode, amountNpr: Number(line.amountNpr || 0) };

function Totals({ rows }: { rows: ReturnType<typeof invoiceTotalsRows> }) {
  return <dl className="ml-auto grid w-full max-w-md grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-forest/15 pt-3 text-sm">
    {rows.map((row, index) => <div key={`${row.kind}-${index}`} className={`col-span-2 grid grid-cols-subgrid ${row.kind === "amountDue" ? "mt-1 border-t border-forest/20 pt-2 text-base font-semibold" : row.kind === "net" ? "font-medium" : ""}`}><dt>{row.label}</dt><dd className="text-right">{formatNpr(row.amountNpr)}</dd></div>)}
  </dl>;
}

export function InvoiceIssueForm({ reservationId, rooms, extras, nights, allowAboveStandard, submissionId }: {
  reservationId: string; rooms: IssueRoom[]; extras: IssueExtra[]; nights: number; allowAboveStandard: boolean; submissionId: string;
}) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(issueInvoiceAction, null);
  const router = useRouter();
  const [rates, setRates] = useState(() => Object.fromEntries(rooms.map((room) => [room.id, String(room.standardRateNpr)])));
  const [lines, setLines] = useState<AdjustmentDraft[]>(() => extras.map(adjustmentFromExtra));
  const [taxRows, setTaxRows] = useState<TaxDraft[]>([]);
  const [allowAbove, setAllowAbove] = useState(false);
  const serializedLines = lines.map(serializeAdjustment);
  const serializedTaxes = taxRows.map(serializeTax) as InvoiceTaxInput[];
  const roomInputs = rooms.map((room) => ({ id: room.id, roomTypeName: room.name, roomName: room.roomName, standardRateNpr: room.standardRateNpr, childRateNpr: room.childRateNpr, children: room.children, discountedRateNpr: Number(rates[room.id] || 0) }));
  let totals;
  try { totals = calculateInvoiceTotals(roomInputs, serializedLines as InvoiceAdjustmentInput[], nights, { allowAboveStandard: allowAbove, taxRows: serializedTaxes }); }
  catch { totals = calculateInvoiceTotals([], [], nights); }
  const rows = invoiceTotalsRows(totals);

  useEffect(() => {
    if (result?.ok && result.invoiceId) router.replace(invoiceIssuedHref(result.invoiceId));
  }, [result, router]);

  function updateLine(id: string, changes: Partial<AdjustmentDraft>) { setLines((current) => current.map((line) => line.id === id ? { ...line, ...changes } : line)); }
  function addLine() { setLines((current) => [...current, { id: `manual-${crypto.randomUUID()}`, type: "CHARGE", description: "", reference: "", quantity: "1", unitAmountNpr: "0", unitLabel: "" }]); }
  function addTax() { setTaxRows((current) => [...current, { id: `tax-${crypto.randomUUID()}`, label: "", mode: "PERCENT", percentage: "", amountNpr: "0" }]); }
  function updateTax(id: string, changes: Partial<TaxDraft>) { setTaxRows((current) => current.map((tax) => tax.id === id ? { ...tax, ...changes } : tax)); }
  const taxSnapshots = new Map(totals.taxLines.map((line) => [line.id, line]));

  return <form action={action} className="space-y-5">
    <input type="hidden" name="reservationId" value={reservationId} />
    <input type="hidden" name="submissionId" value={submissionId} />
    <input type="hidden" name="adjustmentLines" value={JSON.stringify(serializedLines)} />
    <input type="hidden" name="taxRows" value={JSON.stringify(taxRows.map(serializeTax))} />
    <div className="overflow-x-auto rounded-md border border-forest/10 bg-white"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b border-forest/10 bg-cream-dark/50 text-xs uppercase tracking-wide text-charcoal-light"><tr><th className="px-3 py-2">Room</th><th className="px-3 py-2">Standard / night</th><th className="px-3 py-2">Discounted / night</th><th className="px-3 py-2 text-right">Amount</th></tr></thead><tbody className="divide-y divide-forest/10">{rooms.map((room) => <tr key={room.id}><th scope="row" className="px-3 py-3 font-medium">{room.name}{room.roomName ? ` · ${room.roomName}` : ""}<span className="block text-xs font-normal text-charcoal-light">{nights} night{nights === 1 ? "" : "s"}{room.children > 0 ? ` · Child charge ${formatNpr(room.childRateNpr * room.children * nights)}` : ""}</span></th><td className="px-3 py-3">{formatNpr(room.standardRateNpr)}</td><td className="w-40 px-3 py-3"><label className="sr-only" htmlFor={`rate-${room.id}`}>Discounted rate per night for {room.name}</label><Input id={`rate-${room.id}`} name={`roomRate:${room.id}`} type="number" min="0" max="2147483647" step="1" required value={rates[room.id]} onChange={(event) => setRates((current) => ({ ...current, [room.id]: event.target.value }))} /></td><td className="px-3 py-3 text-right font-medium">{formatNpr(totals.roomLines.find((line) => line.id === room.id)?.amountNpr ?? 0)}</td></tr>)}</tbody></table></div>

    <fieldset className="space-y-3"><legend className="text-sm font-semibold">Charges and discounts</legend>{lines.length === 0 && <p className="text-sm text-charcoal-light">No additional lines. Booking extras appear here when present.</p>}{lines.map((line) => {
      const extra = Boolean(line.sourceExtraId);
      const snapshot = totals.invoiceLines.find((item) => item.id === line.id);
      return <div key={line.id} className="grid gap-3 rounded-md border border-forest/10 bg-white p-3 sm:grid-cols-[9rem_minmax(10rem,1fr)_minmax(9rem,.7fr)_auto]"><label className="text-sm font-medium">Type<Select value={line.type} disabled={extra} onChange={(event) => updateLine(line.id, { type: event.target.value as AdjustmentDraft["type"], sourceExtraId: undefined })} className="mt-1"><option value="CHARGE">Charge</option><option value="DISCOUNT">Discount</option></Select></label><label className="text-sm font-medium">Description<Input value={line.description} readOnly={extra} required maxLength={240} onChange={(event) => updateLine(line.id, { description: event.target.value })} className="mt-1" /></label><label className="text-sm font-medium">Reference (optional)<Input value={line.reference} maxLength={120} onChange={(event) => updateLine(line.id, { reference: event.target.value })} className="mt-1" /></label><Button type="button" variant="danger" size="sm" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>Remove</Button><div className="grid gap-3 sm:col-span-full sm:grid-cols-[8rem_8rem_1fr]"><label className="text-sm font-medium">Quantity<Input type="number" min="0.01" step="any" required readOnly={extra} value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} className="mt-1" /></label>{line.type === "CHARGE" && !extra && <label className="text-sm font-medium">Unit<Input value={line.unitLabel} maxLength={40} placeholder="e.g. pcs, kg" onChange={(event) => updateLine(line.id, { unitLabel: event.target.value })} className="mt-1" /></label>}<label className="text-sm font-medium">Rate (NPR)<Input type="number" min="0" max="2147483647" step="1" required value={line.unitAmountNpr} onChange={(event) => updateLine(line.id, { unitAmountNpr: event.target.value })} className="mt-1" /></label></div><p className="text-right text-sm font-medium sm:col-span-full">Line amount: {formatNpr(snapshot?.amountNpr ?? 0)}</p></div>;
    })}<Button type="button" variant="secondary" onClick={addLine}>Add line</Button><p className="text-xs text-charcoal-light">Booking extras are added as Charge lines at their saved quantity; enter a rate or leave zero for Included.</p></fieldset>

    <section className="space-y-3 rounded-md border border-forest/10 bg-white p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">Tax</h3><Button type="button" variant="secondary" size="sm" onClick={addTax}>+ Add tax</Button></div>{taxRows.length === 0 && <p className="text-sm text-charcoal-light">No tax applied.</p>}{taxRows.map((tax) => {
      const preview = taxSnapshots.get(tax.id);
      return <div key={tax.id} className="grid gap-3 rounded-md border border-forest/10 p-3 sm:grid-cols-[minmax(10rem,1fr)_10rem_minmax(10rem,.8fr)_auto] sm:items-end"><label className="text-sm font-medium">Label<Input value={tax.label} required maxLength={80} placeholder="VAT or Service charge" onChange={(event) => updateTax(tax.id, { label: event.target.value })} className="mt-1" /></label><label className="text-sm font-medium">Calculation<Select value={tax.mode} onChange={(event) => updateTax(tax.id, { mode: event.target.value as TaxDraft["mode"] })} className="mt-1"><option value="PERCENT">% of subtotal</option><option value="FIXED">Fixed amount</option></Select></label>{tax.mode === "PERCENT" ? <div><label className="text-sm font-medium">Percent<Input type="number" min="0" max="100" step="0.01" value={tax.percentage} onChange={(event) => updateTax(tax.id, { percentage: event.target.value })} className="mt-1" /></label><div className="mt-1 flex gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => updateTax(tax.id, { percentage: "13" })}>13%</Button><Button type="button" variant="ghost" size="sm" onClick={() => updateTax(tax.id, { percentage: "10" })}>10%</Button></div></div> : <label className="text-sm font-medium">Fixed amount (NPR)<Input type="number" min="0" max="2147483647" step="1" value={tax.amountNpr} onChange={(event) => updateTax(tax.id, { amountNpr: event.target.value })} className="mt-1" /></label>}<Button type="button" variant="danger" size="sm" onClick={() => setTaxRows((current) => current.filter((item) => item.id !== tax.id))}>Remove</Button>{tax.mode === "PERCENT" && <p className="text-sm text-charcoal-light sm:col-span-full">{tax.percentage || "0"}% of {formatNpr(totals.netNpr)} = {formatNpr(preview?.amountNpr ?? 0)}</p>}</div>;
    })}</section>

    {allowAboveStandard && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="allowAboveStandard" checked={allowAbove} onChange={(event) => setAllowAbove(event.target.checked)} className="size-4 accent-forest" /> Allow above standard rate</label>}
    <Totals rows={rows} />
    <p className="text-xs text-charcoal-light">Discounted room rates default to standard rates. Child charges remain as saved on each booking line.</p>
    {result && !result.ok && <FormMessage type="error">{result.error}</FormMessage>}
    <Button type="submit" disabled={pending || result?.ok === true}>{pending ? "Issuing…" : result?.ok ? result.message : "Issue invoice"}</Button>
  </form>;
}
