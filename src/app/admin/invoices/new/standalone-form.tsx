"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import { formatNpr } from "@/lib/money";
import { todayInResort } from "@/lib/dates";
import type { ActionResult } from "@/lib/actions";
import { calculateInvoiceTotals, invoiceTotalsRows, type InvoiceAdjustmentInput, type InvoiceTaxInput } from "@/lib/invoice/pricing";
import { invoiceIssuedHref } from "@/lib/invoice/navigation";
import { issueStandaloneInvoiceAction } from "../actions";

type GuestOption = { id: string; name: string; phone: string | null; email: string | null; address: string | null; country: string | null };
type InvoiceLineDraft = { id: string; type: "CHARGE" | "DISCOUNT"; description: string; reference: string; quantity: string; unitAmountNpr: string };
type TaxDraft = { id: string; label: string; mode: "PERCENT" | "FIXED"; percentage: string; amountNpr: string };
const toLine = (line: InvoiceLineDraft) => ({ ...line, quantity: Number(line.quantity), unitAmountNpr: Number(line.unitAmountNpr) });
const toTax = (line: TaxDraft) => line.mode === "PERCENT" ? { id: line.id, label: line.label, mode: line.mode, percentage: Number(line.percentage || 0) } : { id: line.id, label: line.label, mode: line.mode, amountNpr: Number(line.amountNpr || 0) };

export function StandaloneInvoiceForm({ guests, submissionId }: { guests: GuestOption[]; submissionId: string }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(issueStandaloneInvoiceAction, null);
  const router = useRouter();
  const [guestId, setGuestId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [lines, setLines] = useState<InvoiceLineDraft[]>([{ id: "line-1", type: "CHARGE", description: "", reference: "", quantity: "1", unitAmountNpr: "0" }]);
  const [taxRows, setTaxRows] = useState<TaxDraft[]>([]);
  const [invoiceDate, setInvoiceDate] = useState(() => todayInResort().toISOString().slice(0, 10));
  const lineInputs = lines.map(toLine);
  const taxInputs = taxRows.map(toTax) as InvoiceTaxInput[];
  let totals;
  try { totals = calculateInvoiceTotals([], lineInputs as InvoiceAdjustmentInput[], 1, { taxRows: taxInputs }); }
  catch { totals = calculateInvoiceTotals([], [], 1); }
  const snapshots = new Map(totals.invoiceLines.map((line) => [line.id, line]));

  useEffect(() => { if (result?.ok && result.invoiceId) router.replace(invoiceIssuedHref(result.invoiceId)); }, [result, router]);

  function updateLine(id: string, value: Partial<InvoiceLineDraft>) { setLines((current) => current.map((line) => line.id === id ? { ...line, ...value } : line)); }
  function updateTax(id: string, value: Partial<TaxDraft>) { setTaxRows((current) => current.map((line) => line.id === id ? { ...line, ...value } : line)); }
  function selectGuest(id: string) {
    setGuestId(id);
    const guest = guests.find((item) => item.id === id);
    if (guest) { setName(guest.name); setPhone(guest.phone ?? ""); setEmail(guest.email ?? ""); setAddress(guest.address ?? ""); }
    else { setName(""); setPhone(""); setEmail(""); setAddress(""); }
  }
  const taxSnapshots = new Map(totals.taxLines.map((tax) => [tax.id, tax]));

  return <form action={action} className="space-y-6">
    <input type="hidden" name="submissionId" value={submissionId} />
    <input type="hidden" name="lines" value={JSON.stringify(lineInputs)} />
    <input type="hidden" name="taxRows" value={JSON.stringify(taxRows.map(toTax))} />
    <section className="space-y-3 rounded-md border border-forest/10 bg-white p-4"><h2 className="font-semibold">Bill to</h2>
      <label className="block text-sm font-medium">Prefill from existing guest<Select value={guestId} onChange={(event) => selectGuest(event.target.value)} className="mt-1"><option value="">Enter a new bill-to contact</option>{guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.name}{guest.phone ? ` · ${guest.phone}` : ""}</option>)}</Select></label>
      <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Bill-to name<Input required maxLength={160} value={name} onChange={(event) => setName(event.target.value)} name="name" className="mt-1" /></label><label className="text-sm font-medium">Phone<Input required maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} name="phone" className="mt-1" /></label><label className="text-sm font-medium">Email (optional)<Input type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} name="email" className="mt-1" /></label><label className="text-sm font-medium sm:col-span-2">Address (optional)<Textarea maxLength={300} value={address} onChange={(event) => setAddress(event.target.value)} name="address" rows={2} className="mt-1" /></label></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="saveAsGuest" className="size-4 accent-forest" /> Save these details as a guest</label>
    </section>
    <section className="grid gap-3 rounded-md border border-forest/10 bg-white p-4 sm:grid-cols-3"><label className="text-sm font-medium">Invoice date<Input name="invoiceDate" type="date" required value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} className="mt-1" /></label><label className="text-sm font-medium">Stay check-in (optional)<Input name="checkIn" type="date" className="mt-1" /></label><label className="text-sm font-medium">Stay check-out (optional)<Input name="checkOut" type="date" className="mt-1" /></label></section>

    <fieldset className="space-y-3"><legend className="font-semibold">Charge and Discount lines</legend>{lines.map((line) => <div key={line.id} className="grid gap-3 rounded-md border border-forest/10 bg-white p-3 sm:grid-cols-[9rem_minmax(10rem,1fr)_6rem_9rem_auto] sm:items-end">
      <label className="text-sm font-medium">Type<Select value={line.type} onChange={(event) => updateLine(line.id, { type: event.target.value as InvoiceLineDraft["type"] })} className="mt-1"><option value="CHARGE">Charge</option><option value="DISCOUNT">Discount</option></Select></label>
      <label className="text-sm font-medium">Description<Input required maxLength={240} value={line.description} onChange={(event) => updateLine(line.id, { description: event.target.value })} className="mt-1" /></label>
      <label className="text-sm font-medium">Quantity<Input type="number" min="0.01" step="any" required value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} className="mt-1" /></label>
      <label className="text-sm font-medium">Rate (NPR)<Input type="number" min="0" max="2147483647" step="1" required value={line.unitAmountNpr} onChange={(event) => updateLine(line.id, { unitAmountNpr: event.target.value })} className="mt-1" /></label>
      <Button type="button" variant="danger" size="sm" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>Remove</Button>
      <p className="text-right text-sm sm:col-span-full">Line total: {formatNpr(snapshots.get(line.id)?.amountNpr ?? 0)}</p>
    </div>)}<Button type="button" variant="secondary" onClick={() => setLines((current) => [...current, { id: `line-${Date.now()}-${current.length}`, type: "CHARGE", description: "", reference: "", quantity: "1", unitAmountNpr: "0" }])}>Add line</Button></fieldset>

    <section className="space-y-3 rounded-md border border-forest/10 bg-white p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">Tax</h3><Button type="button" variant="secondary" size="sm" onClick={() => setTaxRows((current) => [...current, { id: `tax-${Date.now()}-${current.length}`, label: "", mode: "PERCENT", percentage: "", amountNpr: "0" }])}>+ Add tax</Button></div>{taxRows.length === 0 && <p className="text-sm text-charcoal-light">No tax applied.</p>}{taxRows.map((tax) => {
      const preview = taxSnapshots.get(tax.id);
      return <div key={tax.id} className="grid gap-3 rounded-md border border-forest/10 p-3 sm:grid-cols-[minmax(10rem,1fr)_10rem_minmax(10rem,.8fr)_auto] sm:items-end"><label className="text-sm font-medium">Label<Input value={tax.label} required maxLength={80} placeholder="VAT or Service charge" onChange={(event) => updateTax(tax.id, { label: event.target.value })} className="mt-1" /></label><label className="text-sm font-medium">Calculation<Select value={tax.mode} onChange={(event) => updateTax(tax.id, { mode: event.target.value as TaxDraft["mode"] })} className="mt-1"><option value="PERCENT">% of subtotal</option><option value="FIXED">Fixed amount</option></Select></label>{tax.mode === "PERCENT" ? <div><label className="text-sm font-medium">Percent<Input type="number" min="0" max="100" step="0.01" value={tax.percentage} onChange={(event) => updateTax(tax.id, { percentage: event.target.value })} className="mt-1" /></label><div className="mt-1 flex gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => updateTax(tax.id, { percentage: "13" })}>13%</Button><Button type="button" variant="ghost" size="sm" onClick={() => updateTax(tax.id, { percentage: "10" })}>10%</Button></div></div> : <label className="text-sm font-medium">Fixed amount (NPR)<Input type="number" min="0" max="2147483647" step="1" value={tax.amountNpr} onChange={(event) => updateTax(tax.id, { amountNpr: event.target.value })} className="mt-1" /></label>}<Button type="button" variant="danger" size="sm" onClick={() => setTaxRows((current) => current.filter((item) => item.id !== tax.id))}>Remove</Button>{tax.mode === "PERCENT" && <p className="text-sm text-charcoal-light sm:col-span-full">{tax.percentage || "0"}% of {formatNpr(totals.netNpr)} = {formatNpr(preview?.amountNpr ?? 0)}</p>}</div>;
    })}</section>
    <label className="block text-sm font-medium">Reference note (optional)<Input name="referenceNote" maxLength={500} placeholder="Purchase order or other reference" className="mt-1" /></label>
    <dl className="ml-auto grid w-full max-w-md grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-forest/15 pt-3 text-sm">{invoiceTotalsRows(totals).map((row, index) => <div key={`${row.kind}-${index}`} className={`col-span-2 grid grid-cols-subgrid ${row.kind === "amountDue" ? "mt-1 border-t border-forest/20 pt-2 text-base font-semibold" : row.kind === "net" ? "font-medium" : ""}`}><dt>{row.label}</dt><dd className="text-right">{formatNpr(row.amountNpr)}</dd></div>)}</dl>
    {result && !result.ok && <FormMessage type="error">{result.error}</FormMessage>}<Button type="submit" disabled={pending || result?.ok === true}>{pending ? "Issuing…" : result?.ok ? result.message : "Issue standalone invoice"}</Button>
  </form>;
}
