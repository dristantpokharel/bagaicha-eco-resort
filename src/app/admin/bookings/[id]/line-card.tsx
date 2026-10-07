"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input, Select } from "@/components/ui/form";
import { StatusBadge } from "@/components/admin/status-badge";
import type { ActionResult } from "@/lib/actions";
import type { BookingStatus } from "@/generated/prisma/enums";
import type { EditableFlags } from "@/lib/booking/status";
import { cancelLine, checkInLine, checkOutLine, confirmLine, updateBookingLine } from "../actions";

export type LineView = {
  id: string;
  number: number;
  status: BookingStatus;
  roomTypeId: string;
  roomTypeName: string;
  roomId: string | null;
  roomName: string | null;
  adults: number;
  children: number;
  guestsLabel: string;
  priceLines: string[];
  totalLabel: string;
  cancellationReason: string | null;
  flags: Pick<EditableFlags, "party" | "roomType" | "room">;
  /** Free rooms of this line's type for the stay (to confirm into, or move a confirmed room to). */
  rooms: { id: string; name: string }[];
};

type ServerAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

/** One room of a reservation: what it is, its price, and the things staff can do to it. */
export function LineCard({
  line,
  roomTypes,
  canCancel,
  checkInOpensOn,
  childUnderAge,
}: {
  line: LineView;
  roomTypes: { id: string; name: string }[];
  canCancel: boolean;
  /** Set (formatted) while check-in is still in the future. */
  checkInOpensOn: string | null;
  childUnderAge: number;
}) {
  const [message, setMessage] = useState<ActionResult | null>(null);
  const wrap = (fn: ServerAction): ServerAction => async (prev, formData) => {
    const result = await fn(prev, formData);
    setMessage(result);
    return result;
  };
  const [, confirmAction, confirming] = useActionState<ActionResult | null, FormData>(wrap(confirmLine), null);
  const [, checkInAction, checkingIn] = useActionState<ActionResult | null, FormData>(wrap(checkInLine), null);
  const [, checkOutAction, checkingOut] = useActionState<ActionResult | null, FormData>(wrap(checkOutLine), null);
  const [, cancelAction, cancelling] = useActionState<ActionResult | null, FormData>(wrap(cancelLine), null);
  const [editResult, editAction, saving] = useActionState<ActionResult | null, FormData>(updateBookingLine, null);
  const [askingCancel, setAskingCancel] = useState(false);
  const [editing, setEditing] = useState(false);

  const { status } = line;
  const cancellable = status === "PENDING" || status === "CONFIRMED";
  const editable = line.flags.party || line.flags.roomType || line.flags.room;
  const errors = editResult && !editResult.ok ? editResult.fieldErrors : undefined;

  return (
    <li className="space-y-3 p-5" aria-label={`Room ${line.number}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-charcoal">
            Room {line.number}: {line.roomTypeName}
          </h3>
          <p className="text-sm text-charcoal-light">
            {line.roomName ? `Room ${line.roomName}` : <span className="text-warning">No room assigned yet</span>} · {line.guestsLabel}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="text-sm text-charcoal-light">
        {line.priceLines.map((l) => (
          <p key={l}>{l}</p>
        ))}
        <p className="font-medium text-charcoal">{line.totalLabel}</p>
        {line.cancellationReason && <p className="mt-1 text-error">Cancelled: {line.cancellationReason}</p>}
      </div>

      <ActionMessage result={message ?? (editResult && editResult.ok ? editResult : null)} />

      {status === "PENDING" && (
        <form action={confirmAction} className="flex flex-wrap items-end gap-3" noValidate>
          <input type="hidden" name="bookingId" value={line.id} />
          {line.rooms.length > 0 ? (
            <>
              <Field id={`confirm-room-${line.id}`} label="Room to assign">
                <Select id={`confirm-room-${line.id}`} name="roomId" defaultValue={line.rooms[0].id}>
                  {line.rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" disabled={confirming}>
                {confirming ? "Confirming…" : "Confirm this room"}
              </Button>
            </>
          ) : (
            <p className="text-sm text-warning">No room of this type is free for these dates (booked or blocked).</p>
          )}
        </form>
      )}

      {status === "CONFIRMED" && (
        <form action={checkInAction}>
          <input type="hidden" name="bookingId" value={line.id} />
          <Button type="submit" disabled={checkingIn || checkInOpensOn !== null}>
            {checkingIn ? "Checking in…" : "Check in"}
          </Button>
          {checkInOpensOn && <p className="mt-1 text-xs text-charcoal-light">Check-in opens on {checkInOpensOn}.</p>}
        </form>
      )}

      {status === "CHECKED_IN" && (
        <form action={checkOutAction}>
          <input type="hidden" name="bookingId" value={line.id} />
          <Button type="submit" disabled={checkingOut}>
            {checkingOut ? "Checking out…" : "Check out"}
          </Button>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        {editable && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
            {editing ? "Close editor" : "Edit this room"}
          </Button>
        )}
        {cancellable && canCancel && !askingCancel && (
          <Button type="button" variant="danger" size="sm" onClick={() => setAskingCancel(true)}>
            Cancel this room…
          </Button>
        )}
      </div>

      {askingCancel && (
        <form action={cancelAction} className="space-y-3 border-t border-forest/10 pt-3" noValidate>
          <input type="hidden" name="bookingId" value={line.id} />
          <Field id={`cancel-reason-${line.id}`} label="Reason for cancelling this room" hint="Saved on the room and included in the guest's email.">
            <Input id={`cancel-reason-${line.id}`} name="reason" maxLength={500} required />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" variant="danger" disabled={cancelling}>
              {cancelling ? "Cancelling…" : "Confirm cancellation"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAskingCancel(false)}>
              Keep room
            </Button>
          </div>
        </form>
      )}
      {cancellable && !canCancel && <p className="text-xs text-charcoal-light">Only an Admin can cancel rooms.</p>}

      {editing && editable && (
        <form action={editAction} className="grid gap-3 border-t border-forest/10 pt-3 sm:grid-cols-2" noValidate>
          <input type="hidden" name="bookingId" value={line.id} />
          {line.flags.party && (
            <>
              <Field id={`edit-adults-${line.id}`} label="Adults" error={errors?.adults}>
                <Input id={`edit-adults-${line.id}`} name="adults" type="number" min={1} max={20} defaultValue={line.adults} />
              </Field>
              <Field id={`edit-children-${line.id}`} label={`Children under ${childUnderAge}`} error={errors?.children}>
                <Input id={`edit-children-${line.id}`} name="children" type="number" min={0} max={20} defaultValue={line.children} />
              </Field>
            </>
          )}
          {line.flags.roomType && (
            <Field id={`edit-type-${line.id}`} label="Room type" hint="Changing it reprices this room at the new type's current rates.">
              <Select id={`edit-type-${line.id}`} name="roomTypeId" defaultValue={line.roomTypeId}>
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {line.flags.room && line.roomId && (
            <Field id={`edit-room-${line.id}`} label="Room" hint="Free rooms of this type for these dates.">
              <Select id={`edit-room-${line.id}`} name="roomId" defaultValue={line.roomId}>
                {line.rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="sm:col-span-2">
            {editResult && !editResult.ok && <ActionMessage result={editResult} />}
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save this room"}
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}
