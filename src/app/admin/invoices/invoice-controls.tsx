"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Input, Select, Textarea } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import { todayInResort } from "@/lib/dates";
import { emailInvoiceAction, markInvoicePaidAction, voidInvoiceAction } from "./actions";

export function InvoiceControls({
  invoiceId,
  status,
  canManage,
}: {
  invoiceId: string;
  status: "ISSUED" | "PAID" | "VOID";
  canManage: boolean;
}) {
  const [emailResult, emailAction, emailPending] = useActionState<ActionResult | null, FormData>(emailInvoiceAction, null);
  const [paidResult, paidAction, paidPending] = useActionState<ActionResult | null, FormData>(markInvoicePaidAction, null);
  const [voidResult, voidAction, voidPending] = useActionState<ActionResult | null, FormData>(voidInvoiceAction, null);
  const today = todayInResort().toISOString().slice(0, 10);
  return <div className="space-y-4 print:hidden">
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" onClick={() => window.print()}>Print</Button>
      {canManage && status !== "VOID" && <form action={emailAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="invoiceId" value={invoiceId} />
        <Button type="submit" variant="secondary" disabled={emailPending}>{emailPending ? "Sending…" : "Email invoice to guest"}</Button>
      </form>}
    </div>
    {emailResult && <FormMessage type={emailResult.ok ? "success" : "error"}>{emailResult.ok ? emailResult.message : emailResult.error}</FormMessage>}
    {canManage && status === "ISSUED" && <form action={paidAction} className="grid gap-3 rounded-md border border-forest/10 bg-white p-4 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <label className="text-sm font-medium">Payment method<Select name="paymentMethod" required defaultValue="CASH" className="mt-1"><option value="CASH">Cash</option><option value="CHEQUE">Cheque</option><option value="FONEPAY">FonePay</option><option value="ESEWA">eSewa</option><option value="BANK_TRANSFER">Bank Transfer</option></Select></label>
      <label className="text-sm font-medium">Paid date<Input name="paidDate" type="date" defaultValue={today} required className="mt-1" /></label>
      <label className="text-sm font-medium">Note (optional)<Input name="paymentNote" maxLength={500} placeholder="Cheque / transaction reference" className="mt-1" /></label>
      <Button type="submit" disabled={paidPending}>{paidPending ? "Saving…" : "Mark as paid"}</Button>
      {paidResult && <div className="sm:col-span-full"><FormMessage type={paidResult.ok ? "success" : "error"}>{paidResult.ok ? paidResult.message : paidResult.error}</FormMessage></div>}
    </form>}
    {canManage && status !== "VOID" && <form action={voidAction} className="space-y-3 rounded-md border border-error/20 bg-white p-4">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <label className="block text-sm font-medium">Void invoice{status === "PAID" ? " (Admin+ only)" : ""}<Textarea name="reason" required minLength={1} maxLength={1000} rows={2} placeholder="Reason for correction or cancellation" className="mt-1" /></label>
      <Button type="submit" variant="danger" disabled={voidPending}>{voidPending ? "Voiding…" : "Void invoice"}</Button>
      {voidResult && <FormMessage type={voidResult.ok ? "success" : "error"}>{voidResult.ok ? voidResult.message : voidResult.error}</FormMessage>}
    </form>}
  </div>;
}
