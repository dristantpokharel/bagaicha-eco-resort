"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import { cancelReservation, confirmAllLines } from "../actions";

/**
 * Whole-reservation actions: confirm every pending room at once, or cancel what can still be cancelled.
 * The server decides what is possible; these only show the buttons that make sense.
 */
export function ReservationActions({
  reservationId,
  pendingCount,
  cancellableCount,
  canCancel,
}: {
  reservationId: string;
  pendingCount: number;
  cancellableCount: number;
  canCancel: boolean;
}) {
  const [confirmResult, confirmAction, confirming] = useActionState<ActionResult | null, FormData>(confirmAllLines, null);
  const [cancelResult, cancelAction, cancelling] = useActionState<ActionResult | null, FormData>(cancelReservation, null);
  const [askingCancel, setAskingCancel] = useState(false);

  return (
    <div className="space-y-4">
      <ActionMessage result={cancelResult ?? confirmResult} />

      {pendingCount > 0 ? (
        <form action={confirmAction} className="space-y-2">
          <input type="hidden" name="reservationId" value={reservationId} />
          <Button type="submit" disabled={confirming}>
            {confirming ? "Confirming…" : pendingCount === 1 ? "Confirm the pending room" : `Confirm all ${pendingCount} pending rooms`}
          </Button>
          <p className="text-xs text-charcoal-light">
            Gives each room a free room of its type, all together. If any type is short, nothing is confirmed.
          </p>
        </form>
      ) : (
        <p className="text-sm text-charcoal-light">No rooms are waiting for confirmation.</p>
      )}

      {cancellableCount > 0 && canCancel && (
        <div className="border-t border-forest/10 pt-4">
          {!askingCancel ? (
            <Button type="button" variant="danger" onClick={() => setAskingCancel(true)}>
              Cancel the whole booking…
            </Button>
          ) : (
            <form action={cancelAction} className="space-y-3" noValidate>
              <input type="hidden" name="reservationId" value={reservationId} />
              <Field id="cancel-all-reason" label="Reason for cancelling" hint="Saved on every cancelled room and included in the guest's email.">
                <Input id="cancel-all-reason" name="reason" maxLength={500} required />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" variant="danger" disabled={cancelling}>
                  {cancelling ? "Cancelling…" : `Cancel ${cancellableCount === 1 ? "the room" : `${cancellableCount} rooms`}`}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setAskingCancel(false)}>
                  Keep booking
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
      {cancellableCount > 0 && !canCancel && (
        <p className="border-t border-forest/10 pt-4 text-xs text-charcoal-light">Only an Admin can cancel bookings.</p>
      )}
    </div>
  );
}
