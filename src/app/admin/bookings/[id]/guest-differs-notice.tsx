"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import type { ActionResult } from "@/lib/actions";
import { linkToNewGuestAction, updateGuestFromSubmitted } from "../actions";

export type DiffRow = { label: string; submitted: string; saved: string };

/** Shown when the details submitted with a booking differ from the guest it was matched to. */
export function GuestDiffersNotice({ reservationId, guestId, rows }: { reservationId: string; guestId: string; rows: DiffRow[] }) {
  const [updateResult, updateAction, updating] = useActionState<ActionResult | null, FormData>(updateGuestFromSubmitted, null);
  const [linkResult, linkAction, linking] = useActionState<ActionResult | null, FormData>(linkToNewGuestAction, null);
  const hidden = (
    <>
      <input type="hidden" name="reservationId" value={reservationId} />
      <input type="hidden" name="guestId" value={guestId} />
    </>
  );

  return (
    <div role="status" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
      <h2 className="font-medium text-charcoal">Submitted details differ from the saved guest</h2>
      <p className="mt-1 text-xs text-charcoal-light">
        This booking, its emails and the lists use what was submitted. The saved guest is only used for history.
      </p>
      <table className="mt-3 w-full text-left">
        <thead>
          <tr className="text-xs text-charcoal-light">
            <th scope="col" className="py-1 pr-3 font-normal" />
            <th scope="col" className="py-1 pr-3 font-normal">Submitted</th>
            <th scope="col" className="py-1 font-normal">Saved guest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="align-top">
              <th scope="row" className="py-1 pr-3 font-normal text-charcoal-light">{r.label}</th>
              <td className="py-1 pr-3 break-all font-medium">{r.submitted}</td>
              <td className="py-1 break-all">{r.saved}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3">
        <ActionMessage result={updateResult ?? linkResult} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={updateAction}>
          {hidden}
          <Button type="submit" disabled={updating || linking}>
            {updating ? "Updating…" : "Update guest with these details"}
          </Button>
        </form>
        <form action={linkAction}>
          {hidden}
          <Button type="submit" variant="ghost" disabled={updating || linking}>
            {linking ? "Linking…" : "Link to a new guest instead"}
          </Button>
        </form>
      </div>
    </div>
  );
}
