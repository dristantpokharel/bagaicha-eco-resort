"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import type { ActionResult } from "@/lib/actions";
import { setRoomTypeActive } from "./actions";

export function RoomTypeStatus({ id, name, isActive }: { id: string; name: string; isActive: boolean }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(setRoomTypeActive, null);
  return (
    <div className="space-y-2">
      <p className="text-sm text-charcoal-light">
        {isActive
          ? "Archiving hides this room type from guests. Existing bookings are kept."
          : "This room type is archived and hidden from guests."}
      </p>
      <form
        action={action}
        onSubmit={(e) => {
          if (isActive && !window.confirm(`Archive ${name}? Guests won't be able to request it.`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="isActive" value={String(!isActive)} />
        <Button type="submit" variant={isActive ? "danger" : "secondary"} size="sm" disabled={pending}>
          {pending ? "Saving…" : isActive ? "Archive room type" : "Reactivate room type"}
        </Button>
      </form>
      <ActionMessage result={result} />
    </div>
  );
}
