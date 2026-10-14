"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Select } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import type { FreeRoom } from "@/lib/admin/today";
import { checkInLine, checkOutLine, confirmAllLines, confirmLine } from "./bookings/actions";

type Action = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

/**
 * Runs an existing server action once per set of fields, one after another, and stops at the first refusal.
 * Permissions and all checks stay in the action; this only calls it. The page refreshes itself afterwards.
 */
function RunButton({
  action,
  runs,
  label,
  busyLabel,
  doneLabel,
  variant = "primary",
  ariaLabel,
  warning,
}: {
  action: Action;
  runs: Record<string, string>[];
  label: string;
  busyLabel: string;
  /** Message after every run succeeded; the action's own message is used for a single run if omitted. */
  doneLabel?: string;
  variant?: "primary" | "secondary";
  ariaLabel?: string;
  /** Asks "are you sure?" before the first run; never blocks, the person can go ahead. */
  warning?: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [asking, setAsking] = useState(false);

  const run = () =>
    start(async () => {
      setAsking(false);
      setResult(null);
      let done = 0;
      let last: ActionResult | null = null;
      for (const fields of runs) {
        const formData = new FormData();
        for (const [name, value] of Object.entries(fields)) formData.set(name, value);
        last = await action(null, formData);
        if (!last.ok) {
          setResult(runs.length > 1 && done > 0 ? { ok: false, error: `${done} of ${runs.length} done. ${last.error}` } : last);
          return;
        }
        done += 1;
      }
      setResult(runs.length === 1 && last ? last : { ok: true, message: doneLabel ?? "Done." });
    });

  if (asking && warning) {
    return (
      <div className="min-w-0 max-w-xs space-y-2 rounded-md border border-warning/40 bg-warning/10 p-2" role="alert">
        <p className="text-sm text-charcoal">{warning}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={run} disabled={pending} className="min-h-11 px-4">
            {pending ? busyLabel : "Check in anyway"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setAsking(false)} className="min-h-11 px-4">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <Button type="button" variant={variant} onClick={warning ? () => setAsking(true) : run} disabled={pending} aria-label={ariaLabel} className="min-h-11 px-4">
        {pending ? busyLabel : label}
      </Button>
      {result && (
        <div className="mt-1">
          <FormMessage type={result.ok ? "success" : "error"}>{result.ok ? result.message : result.error}</FormMessage>
        </div>
      )}
    </div>
  );
}

export function CheckInButton({ bookingIds, room, all, warning }: { bookingIds: string[]; room?: string; all?: boolean; warning?: string }) {
  return (
    <RunButton
      action={checkInLine}
      runs={bookingIds.map((bookingId) => ({ bookingId }))}
      label={all ? `Check in all (${bookingIds.length})` : "Check in"}
      busyLabel="Checking in…"
      doneLabel={`Checked in ${bookingIds.length} rooms.`}
      variant={all ? "secondary" : "primary"}
      ariaLabel={room ? `Check in ${room}` : undefined}
      warning={warning}
    />
  );
}

export function CheckOutButton({ bookingIds, room, all }: { bookingIds: string[]; room?: string; all?: boolean }) {
  return (
    <RunButton
      action={checkOutLine}
      runs={bookingIds.map((bookingId) => ({ bookingId }))}
      label={all ? `Check out all (${bookingIds.length})` : "Check out"}
      busyLabel="Checking out…"
      doneLabel={`Checked out ${bookingIds.length} rooms.`}
      variant={all ? "secondary" : "primary"}
      ariaLabel={room ? `Check out ${room}` : undefined}
    />
  );
}

/** Confirm every pending room of a request at once; each gets a free room of its type (all or nothing). */
export function ConfirmRequestButton({ reservationId, rooms }: { reservationId: string; rooms: number }) {
  return (
    <RunButton
      action={confirmAllLines}
      runs={[{ reservationId }]}
      label={rooms > 1 ? `Confirm ${rooms} rooms` : "Confirm"}
      busyLabel="Confirming…"
    />
  );
}

/** An arriving room with no room number yet: pick one of the free rooms of its type, then confirm. */
export function AssignConfirm({ bookingId, rooms, typeName }: { bookingId: string; rooms: FreeRoom[]; typeName: string }) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  if (rooms.length === 0) {
    return <p className="text-xs text-error">No free {typeName} room for these dates. Open the booking to sort it out.</p>;
  }
  return (
    <div className="flex flex-wrap items-start gap-2">
      <label className="sr-only" htmlFor={`room-${bookingId}`}>
        Room for {typeName}
      </label>
      <Select id={`room-${bookingId}`} value={roomId} onChange={(e) => setRoomId(e.target.value)} className="h-11 w-auto min-w-24">
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </Select>
      <RunButton action={confirmLine} runs={[{ bookingId, roomId }]} label="Assign & confirm" busyLabel="Confirming…" />
    </div>
  );
}
