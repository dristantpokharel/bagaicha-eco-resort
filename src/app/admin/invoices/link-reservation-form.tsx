"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Select } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import { linkStandaloneInvoiceAction } from "./actions";

export function LinkReservationForm({ invoiceId, reservations }: { invoiceId: string; reservations: Array<{ id: string; reference: string; guestName: string }> }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(linkStandaloneInvoiceAction, null);
  return <form action={action} className="flex flex-wrap items-end gap-2 rounded-md border border-forest/10 bg-white p-3 print:hidden">
    <input type="hidden" name="invoiceId" value={invoiceId} />
    <label className="text-sm font-medium">Link to reservation<Select name="reservationId" required defaultValue="" className="mt-1"><option value="" disabled>Select reservation</option>{reservations.map((reservation) => <option key={reservation.id} value={reservation.id}>{reservation.reference} · {reservation.guestName}</option>)}</Select></label>
    <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Linking…" : "Link reservation"}</Button>
    {result && <FormMessage type={result.ok ? "success" : "error"}>{result.ok ? result.message : result.error}</FormMessage>}
  </form>;
}
