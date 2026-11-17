"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Input } from "@/components/ui/form";
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
  const [extraPrices, setExtraPrices] = useState(() => Object.fromEntries(extras.map((extra) => [extra.id, "0"])));
  const totals = useMemo(() => {
    const standard = rooms.reduce((sum, room) => sum + (room.standardRateNpr + room.childRateNpr * room.children) * nights, 0);
    const discount = rooms.reduce((sum, room) => sum + (room.standardRateNpr - Number(rates[room.id] ?? 0)) * nights, 0);
    const extrasTotal = extras.reduce((sum, extra) => sum + Number(extraPrices[extra.id] ?? 0), 0);
    return { standard, discount, grand: standard - discount + extrasTotal };
  }, [rooms, extras, nights, rates, extraPrices]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="reservationId" value={reservationId} />
      <div className="overflow-x-auto rounded-md border border-forest/10 bg-white">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b border-forest/10 bg-cream-dark/50 text-xs uppercase tracking-wide text-charcoal-light">
            <tr><th className="px-3 py-2">Room</th><th className="px-3 py-2">Standard / night</th><th className="px-3 py-2">Discounted / night</th><th className="px-3 py-2">Discount / night</th><th className="px-3 py-2 text-right">Line total</th></tr>
          </thead>
          <tbody className="divide-y divide-forest/10">
            {rooms.map((room) => {
              const discounted = Number(rates[room.id] ?? 0);
              return <tr key={room.id}>
                <th scope="row" className="px-3 py-3 font-medium">{room.name}{room.roomName ? ` · ${room.roomName}` : ""}<span className="block text-xs font-normal text-charcoal-light">{nights} night{nights === 1 ? "" : "s"}{room.children > 0 ? ` · Child charge ${formatNpr(room.childRateNpr * room.children * nights)}` : ""}</span></th>
                <td className="px-3 py-3">{formatNpr(room.standardRateNpr)}</td>
                <td className="w-40 px-3 py-3"><label className="sr-only" htmlFor={`rate-${room.id}`}>Discounted rate per night for {room.name}</label><Input id={`rate-${room.id}`} name={`roomRate:${room.id}`} type="number" min="0" step="1" required value={rates[room.id]} onChange={(event) => setRates((current) => ({ ...current, [room.id]: event.target.value }))} /></td>
                <td className="px-3 py-3">{formatNpr(room.standardRateNpr - discounted)}</td>
                <td className="px-3 py-3 text-right font-medium">{formatNpr(discounted * nights + room.childRateNpr * room.children * nights)}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      {extras.length > 0 && <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Booking extras</legend>
        {extras.map((extra) => <div key={extra.id} className="grid grid-cols-[1fr_9rem] items-center gap-3 text-sm">
          <label htmlFor={`extra-${extra.id}`}>{extra.quantity} {extra.unit} · {extra.name}</label>
          <Input id={`extra-${extra.id}`} name={`extraPrice:${extra.id}`} type="number" min="0" step="1" value={extraPrices[extra.id]} onChange={(event) => setExtraPrices((current) => ({ ...current, [extra.id]: event.target.value }))} aria-label={`Invoice price for ${extra.name}`} />
        </div>)}
        <p className="text-xs text-charcoal-light">Enter the total NPR amount for each extra line. NPR 0 is shown as Included.</p>
      </fieldset>}
      {allowAboveStandard && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="allowAboveStandard" className="size-4 accent-forest" /> Allow above standard rate</label>}
      <p className="text-xs text-charcoal-light">Discounted rates default to standard rates. Child charges remain as saved on each booking line.</p>
      <dl className="ml-auto grid w-full max-w-sm grid-cols-2 gap-x-6 gap-y-1 border-t border-forest/15 pt-3 text-sm">
        <dt>Subtotal at standard rates</dt><dd className="text-right">{formatNpr(totals.standard)}</dd>
        <dt>Total discount</dt><dd className="text-right">{formatNpr(totals.discount)}</dd>
        {extras.length > 0 && <><dt>Extras</dt><dd className="text-right">{formatNpr(totals.grand - (totals.standard - totals.discount))}</dd></>}
        <dt className="font-semibold">Amount sent</dt><dd className="text-right font-semibold">{formatNpr(totals.grand)}</dd>
      </dl>
      {result && <FormMessage type={result.ok ? "success" : "error"}>{result.ok ? result.message : result.error}</FormMessage>}
      <Button type="submit" disabled={pending}>{pending ? "Issuing…" : "Issue invoice"}</Button>
    </form>
  );
}
