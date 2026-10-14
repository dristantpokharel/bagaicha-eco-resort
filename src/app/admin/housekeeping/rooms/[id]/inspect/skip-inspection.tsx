"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { FormMessage, Textarea } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import { skipInspectionAction } from "../../../actions";

/** Admin and up. Marks the inspection as skipped with a reason; the room stays Dirty, ready for prep. */
export function SkipInspection({ roomId, cycle }: { roomId: string; cycle: number }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(skipInspectionAction, null);
  const errors = result && !result.ok ? result.fieldErrors : undefined;

  if (result?.ok) {
    return (
      <div className="mt-6 space-y-3">
        <FormMessage type="success">{result.message}</FormMessage>
        <Link href="/admin/housekeeping" className={buttonClasses({ className: "min-h-12 w-full" })}>
          Back to rooms
        </Link>
      </div>
    );
  }

  return (
    <details className="mt-6 rounded-md border border-forest/15 bg-white p-4">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm text-forest underline underline-offset-4">Skip this inspection (admin)</summary>
      <form action={action} className="mt-3 space-y-3" noValidate>
        <input type="hidden" name="roomId" value={roomId} />
        <input type="hidden" name="cycle" value={cycle} />
        <p className="text-sm text-charcoal-light">Nothing is counted or written off. The room stays Dirty and can be prepared. The reason is logged.</p>
        <label htmlFor="skip-reason" className="block text-sm font-medium text-charcoal">
          Reason (required)
        </label>
        <Textarea id="skip-reason" name="reason" rows={2} maxLength={300} aria-invalid={errors?.reason ? true : undefined} />
        {errors?.reason && <p className="text-xs text-error">{errors.reason}</p>}
        <ActionMessage result={result} />
        <Button type="submit" variant="secondary" className="min-h-11" disabled={pending}>
          {pending ? "Skipping…" : "Skip inspection"}
        </Button>
      </form>
    </details>
  );
}
