"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input, Select } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import type { BookingStatus } from "@/generated/prisma/enums";
import { cancelBooking, checkInBooking, checkOutBooking, confirmBooking } from "../actions";

type ServerAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

/** Status buttons for one booking. One message area shows the latest outcome, even after the button disappears. */
export function BookingActions({
  bookingId,
  status,
  freeRooms,
  canCancel,
  checkInOpensOn,
}: {
  bookingId: string;
  status: BookingStatus;
  /** Free rooms of the booking's type for its dates (suggestions for Confirm). */
  freeRooms: { id: string; name: string }[];
  canCancel: boolean;
  /** Set (formatted) while check-in is still in the future. */
  checkInOpensOn: string | null;
}) {
  const [message, setMessage] = useState<ActionResult | null>(null);
  const wrap = (fn: ServerAction): ServerAction => async (prev, formData) => {
    const result = await fn(prev, formData);
    setMessage(result);
    return result;
  };
  const [, confirmAction, confirming] = useActionState<ActionResult | null, FormData>(wrap(confirmBooking), null);
  const [, checkInAction, checkingIn] = useActionState<ActionResult | null, FormData>(wrap(checkInBooking), null);
  const [, checkOutAction, checkingOut] = useActionState<ActionResult | null, FormData>(wrap(checkOutBooking), null);
  const [, cancelAction, cancelling] = useActionState<ActionResult | null, FormData>(wrap(cancelBooking), null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const cancellable = (status === "PENDING" || status === "CONFIRMED") && canCancel;

  return (
    <div className="space-y-4">
      <ActionMessage result={message} />

      {(status === "CHECKED_OUT" || status === "CANCELLED") && (
        <p className="text-sm text-charcoal-light">This booking is closed. You can still edit its notes.</p>
      )}

      {status === "PENDING" && (
        <form action={confirmAction} className="space-y-3" noValidate>
          <input type="hidden" name="bookingId" value={bookingId} />
          {freeRooms.length > 0 ? (
            <>
              <Field id="confirm-room" label="Assign a room to confirm" hint="Free rooms of this type for these dates.">
                <Select id="confirm-room" name="roomId" defaultValue={freeRooms[0].id}>
                  {freeRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" disabled={confirming}>
                {confirming ? "Confirming…" : "Confirm booking"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-warning">
              No room of this type is free for these dates (booked or blocked). Change the dates in the edit form, or cancel.
            </p>
          )}
        </form>
      )}

      {status === "CONFIRMED" && (
        <form action={checkInAction}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <Button type="submit" disabled={checkingIn || checkInOpensOn !== null}>
            {checkingIn ? "Checking in…" : "Check in guest"}
          </Button>
          {checkInOpensOn && <p className="mt-1 text-xs text-charcoal-light">Check-in opens on {checkInOpensOn}.</p>}
        </form>
      )}

      {status === "CHECKED_IN" && (
        <form action={checkOutAction}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <Button type="submit" disabled={checkingOut}>
            {checkingOut ? "Checking out…" : "Check out guest"}
          </Button>
        </form>
      )}

      {cancellable && (
        <div className="border-t border-forest/10 pt-4">
          {!confirmingCancel ? (
            <Button type="button" variant="danger" onClick={() => setConfirmingCancel(true)}>
              Cancel booking…
            </Button>
          ) : (
            <form action={cancelAction} className="space-y-3" noValidate>
              <input type="hidden" name="bookingId" value={bookingId} />
              <Field id="cancel-reason" label="Reason for cancelling" hint="Saved on the booking and included in the guest's email.">
                <Input id="cancel-reason" name="reason" maxLength={500} required />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" variant="danger" disabled={cancelling}>
                  {cancelling ? "Cancelling…" : "Confirm cancellation"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirmingCancel(false)}>
                  Keep booking
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
      {!canCancel && (status === "PENDING" || status === "CONFIRMED") && (
        <p className="border-t border-forest/10 pt-4 text-xs text-charcoal-light">Only an Admin can cancel bookings.</p>
      )}
    </div>
  );
}
