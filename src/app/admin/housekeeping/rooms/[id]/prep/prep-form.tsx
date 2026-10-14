"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { FormMessage } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import type { PrepLine } from "@/lib/housekeeping/checklist";
import { formatQuantityWithUnit } from "@/lib/inventory/format";
import { completePrepAction } from "../../../actions";
import { Stepper } from "../../../stepper";

/** Prep checklist: tick or adjust each line, then one sticky Complete. */
export function PrepForm({ roomId, cycle, lines, blocked }: { roomId: string; cycle: number; lines: PrepLine[]; blocked: string | null }) {
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(lines.map((l) => [l.itemId, l.need])));
  const [confirmShort, setConfirmShort] = useState(false);
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(completePrepAction, null);
  const errors = result && !result.ok ? result.fieldErrors : undefined;

  if (result?.ok) {
    return (
      <div className="space-y-4">
        <FormMessage type="success">{result.message}</FormMessage>
        <Link href="/admin/housekeeping" className={buttonClasses({ className: "min-h-12 w-full" })}>
          Back to rooms
        </Link>
      </div>
    );
  }
  if (blocked) return <FormMessage type="error">{blocked}</FormMessage>;

  const shortLines = lines.filter((l) => Number(qty[l.itemId] || 0) > Number(l.available));
  const needsConfirm = shortLines.length > 0;

  return (
    <form action={action} noValidate>
      <input type="hidden" name="roomId" value={roomId} />
      <input type="hidden" name="cycle" value={cycle} />
      <div className="mb-3">
        <ActionMessage result={result} />
      </div>

      {lines.length === 0 ? (
        <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-6 text-center text-sm text-charcoal-light">
          Nothing to place: the room already holds its par list (or no par list is set). Complete to mark it ready.
        </p>
      ) : (
        <ul className="divide-y divide-forest/10 rounded-lg border border-forest/10 bg-white">
          {lines.map((line) => {
            const value = qty[line.itemId] ?? "0";
            const placed = Number(value) > 0;
            const short = Number(value) > Number(line.available);
            return (
              <li key={line.itemId} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={placed}
                    onChange={(event) => setQty({ ...qty, [line.itemId]: event.target.checked ? line.need : "0" })}
                    className="size-6 shrink-0 accent-forest"
                    aria-label={`${line.name} placed`}
                  />
                  <span className="min-w-0">
                    <span className="block text-base">{line.name}</span>
                    <span className="block text-xs text-charcoal-light">
                      {line.isConsumable
                        ? `Place ${formatQuantityWithUnit(line.need, line.unit)}`
                        : `Need ${formatQuantityWithUnit(line.need, line.unit)} (par ${line.par}, ${line.inRoom} there)`}
                    </span>
                    {(short || Number(line.available) < Number(line.need)) && (
                      <span className="block text-xs font-medium text-warning">Store has {formatQuantityWithUnit(line.available, line.unit)}</span>
                    )}
                    {errors?.[line.itemId] && <span className="block text-xs text-error">{errors[line.itemId]}</span>}
                  </span>
                </label>
                <Stepper
                  name={`qty:${line.itemId}`}
                  label={line.name}
                  value={value}
                  max={Number(line.need)}
                  onChange={(next) => setQty({ ...qty, [line.itemId]: next })}
                />
              </li>
            );
          })}
        </ul>
      )}

      <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-4 space-y-3 border-t border-forest/15 bg-white px-4 py-3 md:bottom-0 md:mx-0 md:rounded-lg md:border">
        {needsConfirm && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            <p className="font-medium text-warning">The store is short on {shortLines.map((l) => l.name).join(", ")}.</p>
            <p className="mt-1 text-charcoal">Only what the store has will be placed. The gap is flagged and goes on the To-buy list.</p>
            <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3">
              <input type="checkbox" name="acknowledgeShortfall" checked={confirmShort} onChange={(e) => setConfirmShort(e.target.checked)} className="size-6 accent-forest" />
              <span>Complete with the shortfall</span>
            </label>
          </div>
        )}
        <Button type="submit" className="min-h-12 w-full" disabled={pending || (needsConfirm && !confirmShort)}>
          {pending ? "Saving…" : "Complete: room is ready"}
        </Button>
      </div>
    </form>
  );
}
