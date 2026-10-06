"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Input } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import { formatQuantity } from "@/lib/inventory/format";
import { newSubmissionId } from "@/lib/inventory/submission-id";
import { markWashed } from "./actions";

export type LaundryRow = { id: string; name: string; unit: string; quantity: string };

/** Laundry → Store. Enter how many of each came back clean; blank rows are skipped. */
export function WashedForm({ rows }: { rows: LaundryRow[] }) {
  // One token per attempt, kept after a failure so a retry can't move anything twice.
  const submissionId = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [result, action, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    submissionId.current ??= newSubmissionId();
    formData.set("submissionId", submissionId.current);
    let outcome: ActionResult;
    try {
      outcome = await markWashed(prev, formData);
    } catch {
      return {
        ok: false,
        error: "Couldn't reach the server, so we can't tell if this was saved. Check your connection and tap the button again: nothing is moved twice.",
      };
    }
    if (outcome.ok) {
      submissionId.current = null;
      formRef.current?.reset();
    }
    return outcome;
  }, null);

  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      <ActionMessage result={result} />
      <ul className="divide-y divide-forest/10 rounded-lg border border-forest/10 bg-white">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <Link href={`/admin/inventory/${row.id}`} className="font-medium text-forest underline-offset-4 hover:underline">
                {row.name}
              </Link>
              <p className="text-xs text-charcoal-light">
                In laundry: {formatQuantity(row.quantity)} {row.unit}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="sr-only">Washed {row.name}</span>
              <Input name={`washed:${row.id}`} inputMode="decimal" autoComplete="off" placeholder="0" className="min-h-12 w-24 text-right" />
              <span className="text-charcoal-light">{row.unit}</span>
            </label>
          </li>
        ))}
      </ul>
      <Button type="submit" size="md" className="min-h-12 w-full sm:w-auto" disabled={pending}>
        {pending ? "Saving…" : "Move washed items to Store"}
      </Button>
    </form>
  );
}
