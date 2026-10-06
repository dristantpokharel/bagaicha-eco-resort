"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input, Textarea } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import { formatQuantityWithUnit } from "@/lib/inventory/format";
import { MOVEMENT_LABELS } from "@/lib/inventory/labels";
import { NOTE_MAX_LENGTH } from "@/lib/inventory/schemas";
import type { StockMovementType } from "@/generated/prisma/enums";
import { recordMovement } from "./actions";

export type MovementItem = { id: string; name: string; category: string; unit: string; quantity: string };

const AMOUNT_LABEL: Record<StockMovementType, string> = {
  RECEIVED: "Amount received",
  USED: "Amount used",
  ADJUSTED: "Counted quantity on the shelf",
};

/**
 * Records stock movements. With several items it shows a searchable picker (the
 * phone "quick record" page); with one item the item is fixed (the item page).
 * Large tap targets and 16px text keep it usable on a phone.
 */
export function MovementForm({
  items,
  types,
  defaultType,
  defaultItemId,
}: {
  items: MovementItem[];
  types: readonly StockMovementType[];
  defaultType: StockMovementType;
  defaultItemId?: string;
}) {
  const fixed = items.length === 1;
  const [itemId, setItemId] = useState(fixed ? items[0].id : (defaultItemId ?? ""));
  const [type, setType] = useState<StockMovementType>(defaultType);
  const [search, setSearch] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const [result, action, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    const outcome = await recordMovement(prev, formData);
    if (outcome.ok) {
      // Ready for the next entry; the message above keeps the confirmation.
      setQuantity("");
      setNote("");
      setSearch("");
      if (!fixed) setItemId("");
    }
    return outcome;
  }, null);
  const errors = result && !result.ok ? result.fieldErrors : undefined;

  const item = items.find((candidate) => candidate.id === itemId);
  const term = search.trim().toLowerCase();
  const shown = term
    ? items.filter((candidate) => `${candidate.name} ${candidate.category}`.toLowerCase().includes(term))
    : items;
  const noteRequired = type === "ADJUSTED";

  return (
    <form action={action} className="space-y-5" noValidate>
      <ActionMessage result={result} />

      {types.length > 1 && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-charcoal">What happened?</legend>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${types.length}, minmax(0, 1fr))` }}>
            {types.map((option) => (
              <label
                key={option}
                className={`flex min-h-12 cursor-pointer items-center justify-center rounded-md border px-3 text-base font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-forest ${
                  type === option ? "border-forest bg-forest text-cream" : "border-charcoal/25 bg-white text-charcoal"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={option}
                  checked={type === option}
                  onChange={() => setType(option)}
                  className="sr-only"
                />
                {MOVEMENT_LABELS[option]}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {types.length === 1 && <input type="hidden" name="type" value={types[0]} />}

      {fixed ? (
        <input type="hidden" name="itemId" value={items[0].id} />
      ) : (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-charcoal">Item</legend>
          <Input
            type="search"
            aria-label="Search items"
            placeholder="Search items…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="mb-2 min-h-12"
          />
          <div className="max-h-72 overflow-y-auto rounded-md border border-charcoal/25 bg-white" aria-live="polite">
            {shown.length === 0 && <p className="px-3 py-3 text-sm text-charcoal-light">No items match.</p>}
            {shown.map((candidate) => (
              <label
                key={candidate.id}
                className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 border-b border-forest/10 px-3 py-2 last:border-b-0 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-forest ${
                  itemId === candidate.id ? "bg-forest/10" : ""
                }`}
              >
                <input
                  type="radio"
                  name="itemId"
                  value={candidate.id}
                  checked={itemId === candidate.id}
                  onChange={() => setItemId(candidate.id)}
                  className="sr-only"
                />
                <span className="text-base">
                  {candidate.name}
                  <span className="block text-xs text-charcoal-light">{candidate.category}</span>
                </span>
                <span className="text-sm whitespace-nowrap text-charcoal-light">
                  {formatQuantityWithUnit(candidate.quantity, candidate.unit)}
                </span>
              </label>
            ))}
          </div>
          {errors?.itemId && <p className="mt-1 text-xs text-error">{errors.itemId}</p>}
        </fieldset>
      )}

      <Field
        id="movement-quantity"
        label={AMOUNT_LABEL[type]}
        error={errors?.quantity}
        hint={
          item
            ? `In stock: ${formatQuantityWithUnit(item.quantity, item.unit)}${
                type === "ADJUSTED" ? ". Enter what you actually count." : ""
              }`
            : "Choose an item first."
        }
      >
        <div className="flex items-center gap-2">
          <Input
            id="movement-quantity"
            name="quantity"
            inputMode="decimal"
            autoComplete="off"
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="min-h-12"
            aria-invalid={errors?.quantity ? true : undefined}
            aria-describedby={errors?.quantity ? "movement-quantity-error" : "movement-quantity-hint"}
          />
          {item && <span className="text-base text-charcoal">{item.unit}</span>}
        </div>
      </Field>

      <Field
        id="movement-note"
        label={noteRequired ? "Why is the count different? (required)" : "Note (optional)"}
        error={errors?.note}
      >
        <Textarea
          id="movement-note"
          name="note"
          rows={2}
          maxLength={NOTE_MAX_LENGTH}
          required={noteRequired}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-invalid={errors?.note ? true : undefined}
          aria-describedby={errors?.note ? "movement-note-error" : undefined}
        />
      </Field>

      <Button type="submit" size="md" className="min-h-12 w-full sm:w-auto" disabled={pending || !itemId}>
        {pending ? "Saving…" : `Record ${MOVEMENT_LABELS[type].toLowerCase()}`}
      </Button>
    </form>
  );
}
