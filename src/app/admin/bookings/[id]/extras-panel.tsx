"use client";

import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input, Select } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import { newSubmissionId } from "@/lib/inventory/submission-id";
import { addExtraAction, applyExtraAction, removeExtraAction } from "../extras-actions";

export type ExtraView = { id: string; label: string; note: string | null; placed: boolean };
export type ExtraItemOption = { id: string; name: string; unit: string; isConsumable: boolean };

function ApplyExtra({ extra }: { extra: ExtraView }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(applyExtraAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="extraId" value={extra.id} />
      <Button type="submit" variant="secondary" size="sm" className="min-h-11" disabled={pending} aria-label={`Place ${extra.label} in the room now`}>
        {pending ? "Placing…" : "Apply now"}
      </Button>
      {result && !result.ok && <p className="text-xs text-error">{result.error}</p>}
    </form>
  );
}

function RemoveExtra({ extra }: { extra: ExtraView }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(removeExtraAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="extraId" value={extra.id} />
      <Button type="submit" variant="ghost" size="sm" className="min-h-11" disabled={pending} aria-label={`Remove ${extra.label}`}>
        {pending ? "Removing…" : "Remove"}
      </Button>
      {result && !result.ok && <p className="text-xs text-error">{result.error}</p>}
    </form>
  );
}

/** Extras for one booking line: what has been added, and (for staff) a form to add more. */
export function ExtrasPanel({
  bookingId,
  extras,
  items,
  canApplyNow,
}: {
  bookingId: string;
  extras: ExtraView[];
  items: ExtraItemOption[] | null;
  /** The room is Ready (or the guest is in): waiting extras can be placed now. */
  canApplyNow: boolean;
}) {
  // One token per attempt: kept after a failure or a lost response so tapping Add again can't add it twice; cleared once added.
  const submissionId = useRef<string | null>(null);
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    submissionId.current ??= newSubmissionId();
    formData.set("submissionId", submissionId.current);
    try {
      const outcome = await addExtraAction(prev, formData);
      if (outcome.ok) submissionId.current = null;
      return outcome;
    } catch {
      return { ok: false, error: "Couldn't reach the server, so we can't tell if this was added. Check the list, or tap Add again: it won't be added twice." };
    }
  }, null);
  const errors = result && !result.ok ? result.fieldErrors : undefined;
  if (extras.length === 0 && !items) return null;

  return (
    <section className="space-y-2 border-t border-forest/10 pt-3" aria-label="Extras">
      <h4 className="text-sm font-medium text-charcoal">Extras in the room</h4>
      {extras.length === 0 ? (
        <p className="text-sm text-charcoal-light">None.</p>
      ) : (
        <ul className="divide-y divide-forest/10 text-sm">
          {extras.map((extra) => (
            <li key={extra.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
              <span>
                {extra.label}
                {extra.note && <span className="text-charcoal-light"> · {extra.note}</span>}
                <span className={`ml-2 text-xs ${extra.placed ? "text-forest" : "text-warning"}`}>{extra.placed ? "In the room" : "Waiting for room prep"}</span>
              </span>
              {!extra.placed && items && (
                <span className="flex flex-wrap gap-1">
                  {canApplyNow && <ApplyExtra extra={extra} />}
                  <RemoveExtra extra={extra} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {items && (
        <form action={action} className="grid gap-3 sm:grid-cols-[1fr_6rem_1fr_auto] sm:items-end" noValidate>
          <input type="hidden" name="bookingId" value={bookingId} />
          <Field id={`extra-item-${bookingId}`} label="Add an extra" error={errors?.itemId}>
            <Select id={`extra-item-${bookingId}`} name="itemId" defaultValue="" className="min-h-11">
              <option value="">Choose an item…</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.isConsumable ? "used up" : "comes back"})
                </option>
              ))}
            </Select>
          </Field>
          <Field id={`extra-qty-${bookingId}`} label="How many" error={errors?.quantity}>
            <Input id={`extra-qty-${bookingId}`} name="quantity" inputMode="decimal" defaultValue="1" className="min-h-11" />
          </Field>
          <Field id={`extra-note-${bookingId}`} label="Note (optional)" error={errors?.note}>
            <Input id={`extra-note-${bookingId}`} name="note" maxLength={200} className="min-h-11" />
          </Field>
          <Button type="submit" className="min-h-11" disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </Button>
          <div className="sm:col-span-4">
            <ActionMessage result={result} />
          </div>
        </form>
      )}
    </section>
  );
}
