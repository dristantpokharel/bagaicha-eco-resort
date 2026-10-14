"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { FormMessage, Textarea } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import type { InspectionLine } from "@/lib/housekeeping/checklist";
import { formatQuantityWithUnit } from "@/lib/inventory/format";
import { NOTE_MAX_LENGTH } from "@/lib/inventory/schemas";
import { completeInspectionAction } from "../../../actions";
import { Stepper } from "../../../stepper";

type Entry = { counted: string; kind: "LOST" | "DAMAGED"; note: string };

/** Checkout inspection: count what is in the room; anything missing needs lost/damaged and a note. */
export function InspectForm({ roomId, cycle, lines, blocked }: { roomId: string; cycle: number; lines: InspectionLine[]; blocked: string | null }) {
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    Object.fromEntries(lines.map((l) => [l.itemId, { counted: l.expected, kind: "LOST" as const, note: "" }])),
  );
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(completeInspectionAction, null);
  const errors = result && !result.ok ? result.fieldErrors : undefined;
  const patch = (itemId: string, change: Partial<Entry>) => setEntries({ ...entries, [itemId]: { ...entries[itemId], ...change } });

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

  return (
    <form action={action} noValidate>
      <input type="hidden" name="roomId" value={roomId} />
      <input type="hidden" name="cycle" value={cycle} />
      <div className="mb-3">
        <ActionMessage result={result} />
      </div>

      {lines.length === 0 ? (
        <p className="rounded-md border border-dashed border-forest/30 bg-white px-4 py-6 text-center text-sm text-charcoal-light">
          The system has no reusable items in this room, so there is nothing to count. Complete to finish the inspection.
        </p>
      ) : (
        <ul className="divide-y divide-forest/10 rounded-lg border border-forest/10 bg-white">
          {lines.map((line) => {
            const entry = entries[line.itemId];
            const missing = Number(line.expected) - Number(entry.counted || 0);
            return (
              <li key={line.itemId} className="space-y-3 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base">{line.name}</p>
                    <p className="text-xs text-charcoal-light">
                      Should be {formatQuantityWithUnit(line.expected, line.unit)} · {line.isFixedInRoom ? "stays in the room" : "goes to the laundry"}
                    </p>
                  </div>
                  <Stepper
                    name={`count:${line.itemId}`}
                    label={line.name}
                    value={entry.counted}
                    max={Number(line.expected)}
                    onChange={(counted) => patch(line.itemId, { counted })}
                  />
                </div>
                {missing > 0 && (
                  <div className="space-y-2 rounded-md border border-warning/40 bg-warning/10 p-3">
                    <p className="text-sm font-medium text-warning">{formatQuantityWithUnit(String(missing), line.unit)} missing</p>
                    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={`What happened to ${line.name}`}>
                      {(["LOST", "DAMAGED"] as const).map((kind) => (
                        <label
                          key={kind}
                          className={`flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-3 text-base has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-forest ${
                            entry.kind === kind ? "border-forest bg-forest text-cream" : "border-charcoal/25 bg-white text-charcoal"
                          }`}
                        >
                          <input type="radio" name={`kind:${line.itemId}`} value={kind} checked={entry.kind === kind} onChange={() => patch(line.itemId, { kind })} className="sr-only" />
                          {kind === "LOST" ? "Lost / missing" : "Damaged"}
                        </label>
                      ))}
                    </div>
                    <label className="block text-sm font-medium text-charcoal" htmlFor={`note-${line.itemId}`}>
                      What happened? (required)
                    </label>
                    <Textarea
                      id={`note-${line.itemId}`}
                      name={`note:${line.itemId}`}
                      rows={2}
                      maxLength={NOTE_MAX_LENGTH}
                      value={entry.note}
                      onChange={(event) => patch(line.itemId, { note: event.target.value })}
                    />
                  </div>
                )}
                {errors?.[line.itemId] && <p className="text-xs text-error">{errors[line.itemId]}</p>}
              </li>
            );
          })}
        </ul>
      )}

      <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-4 border-t border-forest/15 bg-white px-4 py-3 md:bottom-0 md:mx-0 md:rounded-lg md:border">
        <Button type="submit" className="min-h-12 w-full" disabled={pending}>
          {pending ? "Saving…" : "Complete inspection"}
        </Button>
      </div>
    </form>
  );
}
