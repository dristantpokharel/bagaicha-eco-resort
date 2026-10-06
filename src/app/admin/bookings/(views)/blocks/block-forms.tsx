"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input, Select } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import { createRoomBlock, removeRoomBlock } from "./actions";

export function CreateBlockForm({ rooms }: { rooms: { id: string; label: string }[] }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(createRoomBlock, null);
  const errors = result && !result.ok ? result.fieldErrors : undefined;
  const a11y = (name: string) => ({
    "aria-invalid": errors?.[name] ? true : undefined,
    "aria-describedby": errors?.[name] ? `block-${name}-error` : undefined,
  });

  return (
    <form action={action} className="space-y-4" noValidate>
      <ActionMessage result={result} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="block-roomId" label="Room" error={errors?.roomId}>
          <Select id="block-roomId" name="roomId" required {...a11y("roomId")}>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="block-startDate" label="First blocked night" error={errors?.startDate}>
          <Input id="block-startDate" name="startDate" type="date" required {...a11y("startDate")} />
        </Field>
        <Field id="block-endDate" label="Available again on" error={errors?.endDate} hint="Like check-out: this day is free.">
          <Input id="block-endDate" name="endDate" type="date" required {...a11y("endDate")} />
        </Field>
        <Field id="block-reason" label="Reason" error={errors?.reason}>
          <Input id="block-reason" name="reason" required maxLength={200} placeholder="Maintenance, owner use…" {...a11y("reason")} />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Blocking…" : "Block room"}
      </Button>
    </form>
  );
}

export function RemoveBlockButton({ blockId, label }: { blockId: string; label: string }) {
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(removeRoomBlock, null);
  return (
    <form action={action}>
      <input type="hidden" name="blockId" value={blockId} />
      <Button type="submit" variant="danger" size="sm" disabled={pending} aria-label={`Remove block: ${label}`}>
        {pending ? "Removing…" : "Remove"}
      </Button>
      {result && !result.ok && <p className="mt-1 text-xs text-error">{result.error}</p>}
    </form>
  );
}
