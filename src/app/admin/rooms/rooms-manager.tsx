"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import { createRoom, renameRoom, setRoomActive } from "./actions";

type Room = { id: string; name: string; isActive: boolean };

/** Physical rooms of one room type: add, rename, archive. */
export function RoomsManager({ roomTypeId, rooms }: { roomTypeId: string; rooms: Room[] }) {
  const [addResult, addAction, addPending] = useActionState<ActionResult | null, FormData>(createRoom, null);
  const addError = addResult && !addResult.ok ? addResult.fieldErrors?.name : undefined;

  return (
    <div className="space-y-4">
      {rooms.length === 0 ? (
        <p className="text-sm text-charcoal-light">
          No rooms yet. Add each physical room (by name or number) so bookings can be assigned to it.
        </p>
      ) : (
        <ul className="divide-y divide-forest/10 rounded-md border border-forest/10">
          {rooms.map((room) => (
            <RoomRow key={`${room.id}:${room.name}:${room.isActive}`} room={room} />
          ))}
        </ul>
      )}

      <form action={addAction} className="flex flex-wrap items-end gap-2" noValidate>
        <input type="hidden" name="roomTypeId" value={roomTypeId} />
        <div className="w-full max-w-xs">
          <Field id="new-room-name" label="Add a room" error={addError}>
            <Input
              id="new-room-name"
              name="name"
              maxLength={40}
              placeholder="e.g. 101 or Cottage A"
              aria-invalid={addError ? true : undefined}
              aria-describedby={addError ? "new-room-name-error" : undefined}
            />
          </Field>
        </div>
        <Button type="submit" variant="secondary" disabled={addPending}>
          {addPending ? "Adding…" : "Add room"}
        </Button>
      </form>
      {!addError && <ActionMessage result={addResult} />}
    </div>
  );
}

function RoomRow({ room }: { room: Room }) {
  const [renameResult, renameAction, renamePending] = useActionState<ActionResult | null, FormData>(renameRoom, null);
  const [activeResult, activeAction, activePending] = useActionState<ActionResult | null, FormData>(
    setRoomActive,
    null,
  );
  const renameError = renameResult && !renameResult.ok ? (renameResult.fieldErrors?.name ?? renameResult.error) : null;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
      <form action={renameAction} className="flex items-center gap-2" noValidate>
        <input type="hidden" name="roomId" value={room.id} />
        <label htmlFor={`room-${room.id}`} className="sr-only">
          Room name
        </label>
        <Input
          id={`room-${room.id}`}
          name="name"
          defaultValue={room.name}
          maxLength={40}
          className="h-8 w-40"
          aria-invalid={renameError ? true : undefined}
        />
        <Button type="submit" variant="ghost" size="sm" disabled={renamePending}>
          {renamePending ? "Saving…" : "Rename"}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <span className={`text-sm ${room.isActive ? "text-success" : "text-charcoal-light"}`}>
          {room.isActive ? "Active" : "Archived"}
        </span>
        <form action={activeAction}>
          <input type="hidden" name="id" value={room.id} />
          <input type="hidden" name="isActive" value={String(!room.isActive)} />
          <Button type="submit" variant={room.isActive ? "danger" : "secondary"} size="sm" disabled={activePending}>
            {activePending ? "Saving…" : room.isActive ? "Archive" : "Reactivate"}
          </Button>
        </form>
      </div>

      {renameError && <p className="w-full text-xs text-error">{renameError}</p>}
      <div className="w-full empty:hidden">
        <ActionMessage result={activeResult} />
      </div>
    </li>
  );
}
