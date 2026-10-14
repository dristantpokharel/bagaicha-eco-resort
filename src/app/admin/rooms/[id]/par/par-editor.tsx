"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Input, Select } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import { saveParAction } from "@/app/admin/housekeeping/actions";

export type ParItem = { id: string; name: string; unit: string; isConsumable: boolean };

/**
 * Edits one par list: the rows are the items a room holds and how many. Saving sends the whole list; for a
 * room, `typeQuantities` shows what its type has so one-off differences are easy to see.
 */
export function ParEditor({
  scope,
  items,
  initial,
  typeQuantities,
}: {
  scope: { roomTypeId: string } | { roomId: string };
  items: ParItem[];
  initial: Record<string, string>;
  typeQuantities?: Record<string, string>;
}) {
  const [rows, setRows] = useState<Record<string, string>>(initial);
  const [adding, setAdding] = useState("");
  const [result, action, pending] = useActionState<ActionResult | null, FormData>(saveParAction, null);
  const errors = result && !result.ok ? result.fieldErrors : undefined;

  const byId = new Map(items.map((item) => [item.id, item]));
  const rowIds = Object.keys(rows).sort((a, b) => (byId.get(a)?.name ?? a).localeCompare(byId.get(b)?.name ?? b));
  const addable = items.filter((item) => !(item.id in rows));

  return (
    <form action={action} className="space-y-4" noValidate>
      {"roomTypeId" in scope ? <input type="hidden" name="roomTypeId" value={scope.roomTypeId} /> : <input type="hidden" name="roomId" value={scope.roomId} />}
      <ActionMessage result={result} />

      {rowIds.length === 0 ? (
        <p className="rounded-md border border-dashed border-forest/30 px-4 py-6 text-center text-sm text-charcoal-light">Nothing on this list yet. Add the first item below.</p>
      ) : (
        <ul className="divide-y divide-forest/10 rounded-md border border-forest/10">
          {rowIds.map((itemId) => {
            const item = byId.get(itemId);
            const typeQty = typeQuantities?.[itemId];
            const changed = typeQuantities !== undefined && typeQty !== rows[itemId];
            return (
              <li key={itemId} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-base">{item?.name ?? "Unknown item"}</p>
                  <p className="text-xs text-charcoal-light">
                    {item?.isConsumable ? "Used up" : "Reusable"}
                    {typeQuantities !== undefined && (typeQty === undefined ? " · not on the room type's list" : ` · room type: ${typeQty}`)}
                    {changed && typeQty !== undefined && " · changed for this room"}
                  </p>
                  {errors?.[itemId] && <p className="text-xs text-error">{errors[itemId]}</p>}
                </div>
                <label className="sr-only" htmlFor={`par-${itemId}`}>
                  Quantity of {item?.name}
                </label>
                <Input
                  id={`par-${itemId}`}
                  name={`par:${itemId}`}
                  inputMode="decimal"
                  autoComplete="off"
                  value={rows[itemId]}
                  onChange={(event) => setRows({ ...rows, [itemId]: event.target.value })}
                  className="min-h-11 w-20 text-center"
                  aria-invalid={errors?.[itemId] ? true : undefined}
                />
                <span className="w-8 text-sm text-charcoal-light">{item?.unit}</span>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11"
                  aria-label={`Remove ${item?.name ?? "item"}`}
                  onClick={() => setRows(Object.fromEntries(Object.entries(rows).filter(([id]) => id !== itemId)))}
                >
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <label htmlFor="par-add" className="mb-1 block text-sm font-medium text-charcoal">
            Add an item
          </label>
          <Select id="par-add" value={adding} onChange={(event) => setAdding(event.target.value)} className="min-h-11">
            <option value="">Choose…</option>
            {addable.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.unit})
              </option>
            ))}
          </Select>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          disabled={!adding}
          onClick={() => {
            setRows({ ...rows, [adding]: "1" });
            setAdding("");
          }}
        >
          Add
        </Button>
      </div>

      <Button type="submit" disabled={pending} className="min-h-11">
        {pending ? "Saving…" : "Save par list"}
      </Button>
    </form>
  );
}
