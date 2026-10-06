"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import type { ActionResult } from "@/lib/actions";
import { setItemActive } from "./actions";

export function ArchiveForm({ itemId, isActive }: { itemId: string; isActive: boolean }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(setItemActive, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="isActive" value={String(!isActive)} />
      <ActionMessage result={result} />
      <Button type="submit" variant={isActive ? "danger" : "secondary"} disabled={pending}>
        {pending ? "Saving…" : isActive ? "Archive item" : "Make active again"}
      </Button>
      {isActive && (
        <p className="text-xs text-charcoal-light">
          Archived items are hidden from the list and low-stock alerts and can&apos;t take new movements. History is kept.
        </p>
      )}
    </form>
  );
}
