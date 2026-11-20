"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Input, Select } from "@/components/ui/form";
import { formatNpr } from "@/lib/money";
import type { ActionResult } from "@/lib/actions";
import { issueInvoiceAction } from "../../invoices/actions";

export type IssueRoom = {
  id: string;
  name: string;
  roomName: string | null;
  standardRateNpr: number;
  childRateNpr: number;
  children: number;
};
export type IssueExtra = { id: string; name: string; unit: string; quantity: number };

type AdjustmentDraft = {
  id: string;
  type: "CHARGE" | "TAX" | "DISCOUNT";
  description: string;
  reference: string;
  quantity: string;
  unitAmountNpr: string;
  unitLabel: string;
  sourceExtraId?: string;
  taxCalculation: "PERCENT" | "FIXED";
  percentage: string;
  amountNpr: string;
};

const adjustmentFromExtra = (extra: IssueExtra): AdjustmentDraft => ({
  id: `booking-extra-${extra.id}`, type: "CHARGE", description: extra.name, reference: "",
  quantity: String(extra.quantity), unitAmountNpr: "0", unitLabel: extra.unit, sourceExtraId: extra.id,
  taxCalculation: "FIXED", percentage: "", amountNpr: "0",
});

function serializeLine(line: AdjustmentDraft) {
  const base = { id: line.id, description: line.description, reference: line.reference };
  if (line.type === "CHARGE") return { ...base, type: line.type, quantity: Number(line.quantity), unitAmountNpr: Number(line.unitAmountNpr), unitLabel: line.unitLabel, ...(line.sourceExtraId ? { sourceExtraId: line.sourceExtraId } : {}) };
  if (line.type === "DISCOUNT") return { ...base, type: line.type, quantity: Number(line.quantity), unitAmountNpr: Number(line.unitAmountNpr) };
  return line.taxCalculation === "PERCENT"
    ? { ...base, type: line.type, calculation: line.taxCalculation, percentage: Number(line.percentage) }
    : { ...base, type: line.type, calculation: line.taxCalculation, amountNpr: Number(line.amountNpr) };
}

export function InvoiceIssueForm({
  reservationId,
  rooms,
  extras,
  nights,
  allowAboveStandard,
}: {
  reservationId: string;
  rooms: IssueRoom[];
  extras: IssueExtra[];
  nights: number;
  allowAboveStandard: boolean;
}) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(issueInvoiceAction, null);
  const [rates, setRates] = useState(() => Object.fromEntries(rooms.map((room) => [room.id, String(room.standardRateNpr)])));
  const [lines, setLines] = useState<AdjustmentDraft[]>(() => extras.map(adjustmentFromExtra));
  const totals = useMemo(() => {
    const roomAmounts = rooms.map((room) => Number(rates[room.id] ?? 0) * nights + room.childRateNpr * room.children * nights);
    const standardRoomSubtotal = rooms.reduce((sum, room) => sum + (room.standardRateNpr + room.childRateNpr * room.children) * nights, 0);
    const lineAmounts = lines.map((line) => {
      if (line.type === "TAX") return 0;
      return Math.round(Number(line.quantity || 0) * Number(line.unitAmountNpr || 0));
    });
    const chargeTotal = lines.reduce((sum, line, index) => sum + (line.type === "CHARGE" ? lineAmounts[index] : 0), 0);
    const subtotal = roomAmounts.reduce((sum, amount) => sum + amount, 0) + chargeTotal;
    const taxAmounts = lines.map((line) => line.type !== "TAX" ? 0 : line.taxCalculation === "PERCENT" ? Math.round(subtotal * Number(line.percentage || 0) / 100) : Number(line.amountNpr || 0));
    const tax = taxAmounts.reduce((sum, amount) => sum + amount, 0);
    const discounts = lines.reduce((sum, line, index) => sum + (line.type === "DISCOUNT" ? lineAmounts[index] : 0), 0);
    return { standardRoomSubtotal, roomAmounts, subtotal, taxAmounts, tax, discounts, amountDue: subtotal + tax - discounts };
  }, [rooms, lines, nights, rates]);

  function updateLine(id: string, changes: Partial<AdjustmentDraft>) {
    setLines((current) => current.map((line) => line.id === id ? { ...line, ...changes } : line));
  }

  function addLine() {
    const id = `manual-${crypto.randomUUID()}`;
    setLines((current) => [...current, {
      id, type: "CHARGE", description: "", reference: "", quantity: "1", unitAmountNpr: "0", unitLabel: "",
      taxCalculation: "FIXED", percentage: "", amountNpr: "0",
    }]);
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="reservationId" value={reservationId} />
      <input type="hidden" name="adjustmentLines" value={JSON.stringify(lines.map(serializeLine))} />
      <div className="overflow-x-auto rounded-md border border-forest/10 bg-white">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-forest/10 bg-cream-dark/50 text-xs uppercase tracking-wide text-charcoal-light">
            <tr><th className="px-3 py-2">Room</th><th className="px-3 py-2">Standard / night</th><th className="px-3 py-2">Discounted / night</th><th className="px-3 py-2">Discount / night</th><th className="px-3 py-2 text-right">Line total</th></tr>
          </thead>
          <tbody className="divide-y divide-forest/10">
            {rooms.map((room, index) => {
              const discounted = Number(rates[room.id] ?? 0);
              return <tr key={room.id}>
                <th scope="row" className="px-3 py-3 font-medium">{room.name}{room.roomName ? ` · ${room.roomName}` : ""}<span className="block text-xs font-normal text-charcoal-light">{nights} night{nights === 1 ? "" : "s"}{room.children > 0 ? ` · Child charge ${formatNpr(room.childRateNpr * room.children * nights)}` : ""}</span></th>
                <td className="px-3 py-3">{formatNpr(room.standardRateNpr)}</td>
                <td className="w-40 px-3 py-3"><label className="sr-only" htmlFor={`rate-${room.id}`}>Discounted rate per night for {room.name}</label><Input id={`rate-${room.id}`} name={`roomRate:${room.id}`} type="number" min="0" max="2147483647" step="1" required value={rates[room.id]} onChange={(event) => setRates((current) => ({ ...current, [room.id]: event.target.value }))} /></td>
                <td className="px-3 py-3">{formatNpr(room.standardRateNpr - discounted)}</td>
                <td className="px-3 py-3 text-right font-medium">{formatNpr(totals.roomAmounts[index])}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Charges, tax, and discounts</legend>
        {lines.length === 0 && <p className="text-sm text-charcoal-light">No additional lines. Booking extras appear here when present.</p>}
        {lines.map((line) => {
          const bookingExtra = Boolean(line.sourceExtraId);
          return <div key={line.id} className="space-y-3 rounded-md border border-forest/10 bg-white p-3">
            <div className="grid gap-3 sm:grid-cols-[9rem_minmax(10rem,1fr)_minmax(9rem,0.7fr)_auto] sm:items-end">
              <label className="text-sm font-medium">Type<Select value={line.type} disabled={bookingExtra} onChange={(event) => {
                const type = event.target.value as AdjustmentDraft["type"];
                updateLine(line.id, { type, ...(bookingExtra ? {} : { sourceExtraId: undefined }) });
              }} className="mt-1"><option value="CHARGE">Charge</option><option value="TAX">Tax</option><option value="DISCOUNT">Discount</option></Select></label>
              <label className="text-sm font-medium">Description<Input value={line.description} readOnly={bookingExtra} required maxLength={240} onChange={(event) => updateLine(line.id, { description: event.target.value })} className="mt-1" /></label>
              <label className="text-sm font-medium">Reference (optional)<Input value={line.reference} maxLength={120} placeholder="Bill or transaction number" onChange={(event) => updateLine(line.id, { reference: event.target.value })} className="mt-1" /></label>
              <Button type="button" variant="danger" size="sm" onClick={() => setLines((current) => current.filter((candidate) => candidate.id !== line.id))}>Remove</Button>
            </div>
            {line.type === "CHARGE" || line.type === "DISCOUNT" ? <div className="grid gap-3 sm:grid-cols-[9rem_9rem_1fr] sm:items-end">
              <label className="text-sm font-medium">Quantity<Input type="number" min="0.01" step="any" required readOnly={bookingExtra} value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} className="mt-1" /></label>
              {line.type === "CHARGE" && !bookingExtra && <label className="text-sm font-medium">Unit<Input value={line.unitLabel} maxLength={40} placeholder="e.g. pcs, kg" onChange={(event) => updateLine(line.id, { unitLabel: event.target.value })} className="mt-1" /></label>}
              <label className="text-sm font-medium">Unit amount (NPR)<Input type="number" min="0" max="2147483647" step="1" required value={line.unitAmountNpr} onChange={(event) => updateLine(line.id, { unitAmountNpr: event.target.value })} className="mt-1" /></label>
            </div> : <div className="grid gap-3 sm:grid-cols-[13rem_12rem_1fr] sm:items-end">
              <label className="text-sm font-medium">Tax calculation<Select value={line.taxCalculation} onChange={(event) => updateLine(line.id, { taxCalculation: event.target.value as AdjustmentDraft["taxCalculation"] })} className="mt-1"><option value="PERCENT">Percentage of subtotal</option><option value="FIXED">Fixed amount</option></Select></label>
              {line.taxCalculation === "PERCENT" ? <label className="text-sm font-medium">Tax rate (%)<Input type="number" min="0" step="any" required value={line.percentage} onChange={(event) => updateLine(line.id, { percentage: event.target.value })} className="mt-1" /></label> : <label className="text-sm font-medium">Fixed tax (NPR)<Input type="number" min="0" max="2147483647" step="1" required value={line.amountNpr} onChange={(event) => updateLine(line.id, { amountNpr: event.target.value })} className="mt-1" /></label>}
              <p className="text-sm text-charcoal-light">This line: {formatNpr(line.type === "TAX" ? totals.taxAmounts[lines.indexOf(line)] : 0)}</p>
            </div>}
            <p className="text-right text-sm font-medium">Line amount: {formatNpr(line.type === "TAX" ? totals.taxAmounts[lines.indexOf(line)] : Math.round(Number(line.quantity || 0) * Number(line.unitAmountNpr || 0)))}</p>
          </div>;
        })}
        <Button type="button" variant="secondary" onClick={addLine}>Add line</Button>
        <p className="text-xs text-charcoal-light">Booking extras are included as Charge lines at their saved quantity; set a unit amount or remove a line. Amounts are rounded to whole NPR when issued.</p>
      </fieldset>

      {allowAboveStandard && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="allowAboveStandard" className="size-4 accent-forest" /> Allow above standard rate</label>}
      <dl className="ml-auto grid w-full max-w-sm grid-cols-2 gap-x-6 gap-y-1 border-t border-forest/15 pt-3 text-sm">
        <dt>Subtotal (rooms + charges)</dt><dd className="text-right">{formatNpr(totals.subtotal)}</dd>
        <dt>Tax lines</dt><dd className="text-right">{formatNpr(totals.tax)}</dd>
        <dt>Discounts</dt><dd className="text-right">{formatNpr(totals.discounts)}</dd>
        <dt className="font-semibold">Amount due</dt><dd className="text-right font-semibold">{formatNpr(totals.amountDue)}</dd>
      </dl>
      <p className="text-xs text-charcoal-light">Discounted room rates default to standard rates. Child charges remain as saved on each booking line.</p>
      {result && <FormMessage type={result.ok ? "success" : "error"}>{result.ok ? result.message : result.error}</FormMessage>}
      <Button type="submit" disabled={pending}>{pending ? "Issuing…" : "Issue invoice"}</Button>
    </form>
  );
}
