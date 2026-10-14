"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Input, Select } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import type { RoomStatus } from "@/generated/prisma/enums";
import { MANUAL_STATUSES, OUT_OF_ORDER_HINT, ROOM_STATUS_LABELS } from "@/lib/housekeeping/status";
import { setRoomStatusAction } from "./actions";

/** Change a room's status by hand. Out of order needs a note and shows a hint about blocking dates. */
export function StatusControl({ roomId, roomName, current }: { roomId: string; roomName: string; current: RoomStatus }) {
  const [status, setStatus] = useState<string>("");
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(setRoomStatusAction, null);
  const errors = result && !result.ok ? result.fieldErrors : undefined;
  const options = MANUAL_STATUSES.filter((s) => s !== current && !(current === "OUT_OF_ORDER" && s === "READY"));

  return (
    <details className="group">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm text-forest underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-forest">
        Change status
      </summary>
      <form action={action} className="mt-2 space-y-2" noValidate>
        <input type="hidden" name="roomId" value={roomId} />
        <label className="sr-only" htmlFor={`status-${roomId}`}>
          New status for {roomName}
        </label>
        <Select id={`status-${roomId}`} name="status" value={status} onChange={(e) => setStatus(e.target.value)} className="min-h-11">
          <option value="">Choose…</option>
          {options.map((s) => (
            <option key={s} value={s}>
              {ROOM_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        {errors?.status && <p className="text-xs text-error">{errors.status}</p>}
        {status === "OUT_OF_ORDER" && (
          <>
            <label className="block text-sm font-medium text-charcoal" htmlFor={`note-${roomId}`}>
              What is wrong? (required)
            </label>
            <Input id={`note-${roomId}`} name="note" maxLength={300} className="min-h-11" aria-invalid={errors?.note ? true : undefined} />
            {errors?.note && <p className="text-xs text-error">{errors.note}</p>}
            <p className="text-xs text-charcoal-light">{OUT_OF_ORDER_HINT}</p>
          </>
        )}
        <Button type="submit" variant="secondary" className="min-h-11" disabled={pending || !status}>
          {pending ? "Saving…" : "Save status"}
        </Button>
        <ActionMessage result={result} />
      </form>
    </details>
  );
}
