"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { formatNpr } from "@/lib/money";
import { todayInResort } from "@/lib/dates";
import type { ActionResult } from "@/lib/actions";
import { issueStandaloneInvoiceAction } from "../actions";

type GuestOption = { id: string; name: string; phone: string | null; email: string | null; address: string | null; country: string | null };
type InvoiceLineDraft = { id: string; type: "CHARGE" | "TAX" | "DISCOUNT"; description: string; reference: string; quantity: string; unitAmountNpr: string };

export function StandaloneInvoiceForm({ guests }: { guests: GuestOption[] }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(issueStandaloneInvoiceAction, null);
  const [guestId, setGuestId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [lines, setLines] = useState<InvoiceLineDraft[]>([{ id: "line-1", type: "CHARGE", description: "", reference: "", quantity: "1", unitAmountNpr: "0" }]);
  const [invoiceDate, setInvoiceDate] = useState(() => todayInResort().toISOString().slice(0, 10));
  const subtotal = useMemo(() => lines.reduce((sum, line) => {
    const amount = Math.round(Number(line.quantity || 0) * Number(line.unitAmountNpr || 0));
    return sum + (line.type === "CHARGE" ? amount : 0);
  }, 0), [lines]);
  const taxTotal = useMemo(() => lines.reduce((sum, line) => sum + (line.type === "TAX" ? Math.round(Number(line.quantity || 0) * Number(line.unitAmountNpr || 0)) : 0), 0), [lines]);
  const discountTotal = useMemo(() => lines.reduce((sum, line) => sum + (line.type === "DISCOUNT" ? Math.round(Number(line.quantity || 0) * Number(line.unitAmountNpr || 0)) : 0), 0), [lines]);
  const amountDue = subtotal + taxTotal - discountTotal;
  function updateLine(id: string, value: Partial<InvoiceLineDraft>) { setLines((current) => current.map((line) => line.id === id ? { ...line, ...value } : line)); }
  function selectGuest(id: string) {
    setGuestId(id);
    const guest = guests.find((item) => item.id === id);
    if (!guest) return;
    setName(guest.name); setPhone(guest.phone ?? ""); setEmail(guest.email ?? ""); setAddress(guest.address ?? "");
  }
  return <form action={action} className="space-y-6">
    <input type="hidden" name="lines" value={JSON.stringify(lines.map((line) => ({ ...line, quantity: Number(line.quantity), unitAmountNpr: Number(line.unitAmountNpr) })))} />
    <section className="space-y-3 rounded-md border border-forest/10 bg-white p-4">
      <h2 className="font-semibold">Bill to</h2>
      <label className="block text-sm font-medium">Prefill from existing guest<Select value={guestId} onChange={(event) => selectGuest(event.target.value)} className="mt-1"><option value="">Enter a new bill-to contact</option>{guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.name}{guest.phone ? ` · ${guest.phone}` : ""}</option>)}</Select></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Bill-to name<Input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} name="name" className="mt-1" /></label><label className="text-sm font-medium">Phone<Input required maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} name="phone" className="mt-1" /></label><label className="text-sm font-medium">Email (optional)<Input type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} name="email" className="mt-1" /></label><label className="text-sm font-medium sm:col-span-2">Address (optional)<Textarea maxLength={300} value={address} onChange={(event) => setAddress(event.target.value)} name="address" rows={2} className="mt-1" /></label></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="saveAsGuest" className="size-4 accent-forest" /> Save these details as a guest</label>
    </section>
    <section className="grid gap-3 rounded-md border border-forest/10 bg-white p-4 sm:grid-cols-3"><label className="text-sm font-medium">Invoice date<Input name="invoiceDate" type="date" required value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} className="mt-1" /></label><label className="text-sm font-medium">Stay check-in (optional)<Input name="checkIn" type="date" className="mt-1" /></label><label className="text-sm font-medium">Stay check-out (optional)<Input name="checkOut" type="date" className="mt-1" /></label></section>
    <fieldset className="space-y-3"><legend className="font-semibold">Invoice lines</legend>{lines.map((line) => <div key={line.id} className="grid gap-3 rounded-md border border-forest/10 bg-white p-3 sm:grid-cols-[9rem_minmax(10rem,1fr)_6rem_9rem_auto] sm:items-end">
      <label className="text-sm font-medium">Type<Select value={line.type} onChange={(event) => updateLine(line.id, { type: event.target.value as InvoiceLineDraft["type"] })} className="mt-1"><option value="CHARGE">Charge</option><option value="TAX">Tax</option><option value="DISCOUNT">Discount</option></Select></label>
      <label className="text-sm font-medium">Description<Input required maxLength={240} value={line.description} onChange={(event) => updateLine(line.id, { description: event.target.value })} className="mt-1" /></label>
      <label className="text-sm font-medium">Quantity<Input type="number" min="0.01" step="any" required value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} className="mt-1" /></label>
      <label className="text-sm font-medium">Rate (NPR)<Input type="number" min="0" max="2147483647" step="1" required value={line.unitAmountNpr} onChange={(event) => updateLine(line.id, { unitAmountNpr: event.target.value })} className="mt-1" /></label>
      <Button type="button" variant="danger" size="sm" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>Remove</Button>
      <p className="text-right text-sm sm:col-span-full">Line total: {formatNpr(Math.round(Number(line.quantity || 0) * Number(line.unitAmountNpr || 0)))}</p>
    </div>)}<Button type="button" variant="secondary" onClick={() => setLines((current) => [...current, { id: `line-${Date.now()}-${current.length}`, type: "CHARGE", description: "", reference: "", quantity: "1", unitAmountNpr: "0" }])}>Add line</Button></fieldset>
    <label className="block text-sm font-medium">Reference note (optional)<Input name="referenceNote" maxLength={500} placeholder="Purchase order or other reference" className="mt-1" /></label>
    <dl className="ml-auto grid w-full max-w-sm grid-cols-2 gap-x-6 gap-y-1 border-t border-forest/15 pt-3 text-sm"><dt>Subtotal (charges)</dt><dd className="text-right">{formatNpr(subtotal)}</dd><dt>Tax lines</dt><dd className="text-right">{formatNpr(taxTotal)}</dd><dt>Discounts</dt><dd className="text-right">{formatNpr(discountTotal)}</dd><dt className="font-semibold">Amount due</dt><dd className="text-right font-semibold">{formatNpr(amountDue)}</dd></dl>
    {result && <FormMessage type={result.ok ? "success" : "error"}>{result.ok ? result.message : result.error}</FormMessage>}<Button type="submit" disabled={pending}>{pending ? "Issuing…" : "Issue standalone invoice"}</Button>
  </form>;
}
