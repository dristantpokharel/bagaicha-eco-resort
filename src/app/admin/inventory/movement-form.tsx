"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import { formatQuantityWithUnit } from "@/lib/inventory/format";
import { newSubmissionId } from "@/lib/inventory/submission-id";
import { MOVEMENT_LABELS } from "@/lib/inventory/labels";
import { MOVEMENT_TYPES, NOTE_MAX_LENGTH } from "@/lib/inventory/schemas";
import { recordMovement } from "./actions";

/** The three movements recorded on this form; moves and write-offs have their own forms. */
type RecordableType = (typeof MOVEMENT_TYPES)[number];

export type MovementItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  /** Total on the property. */
  quantity: string;
  /** Reusable items aren't "used up" and are counted per location. */
  isConsumable: boolean;
  /** Reusable items: amount at each location id (missing = 0). */
  balances?: Record<string, string>;
};

export type MovementLocation = { id: string; label: string; isStore: boolean };

const AMOUNT_LABEL: Record<RecordableType, string> = {
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
  locations = [],
}: {
  items: MovementItem[];
  types: readonly RecordableType[];
  defaultType: RecordableType;
  defaultItemId?: string;
  /** Needed when reusable items can be counted (ADJUSTED): where the count was taken. */
  locations?: MovementLocation[];
}) {
  const fixed = items.length === 1;
  const [itemId, setItemId] = useState(fixed ? items[0].id : (defaultItemId ?? ""));
  const [type, setType] = useState<RecordableType>(defaultType);
  const [search, setSearch] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [locationId, setLocationId] = useState(locations.find((location) => location.isStore)?.id ?? "");

  // One token per attempt. It is kept after a failure or a lost response, so tapping
  // Record again can't save the same movement twice, and cleared once saved.
  const submissionId = useRef<string | null>(null);

  const [result, action, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    submissionId.current ??= newSubmissionId();
    formData.set("submissionId", submissionId.current);
    let outcome: ActionResult;
    try {
      outcome = await recordMovement(prev, formData);
    } catch {
      return {
        ok: false,
        error:
          "Couldn't reach the server, so we can't tell if this was saved. Check your connection and tap Record again: it won't be saved twice.",
      };
    }
    if (outcome.ok) {
      submissionId.current = null;
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
  // Reusable items aren't used up; they are moved, written off, received or counted.
  const eligible = type === "USED" ? items.filter((candidate) => candidate.isConsumable) : items;
  const shown = term
    ? eligible.filter((candidate) => `${candidate.name} ${candidate.category}`.toLowerCase().includes(term))
    : eligible;
  const countingAtPlace = item && !item.isConsumable && type === "ADJUSTED";
  const placeBalance = countingAtPlace ? (item.balances?.[locationId] ?? "0") : null;
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
                  onChange={() => {
                    setType(option);
                    if (option === "USED" && !fixed && item && !item.isConsumable) setItemId("");
                  }}
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

      {countingAtPlace && locations.length > 0 && (
        <Field id="movement-location" label="Where did you count?">
          <Select id="movement-location" name="locationId" value={locationId} onChange={(event) => setLocationId(event.target.value)} className="min-h-12">
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field
        id="movement-quantity"
        label={AMOUNT_LABEL[type]}
        error={errors?.quantity}
        hint={
          item
            ? `${
                placeBalance === null
                  ? `In stock: ${formatQuantityWithUnit(item.quantity, item.unit)}`
                  : `At this place: ${formatQuantityWithUnit(placeBalance, item.unit)}`
              }${type === "ADJUSTED" ? ". Enter what you actually count." : ""}${
                !item.isConsumable && type === "RECEIVED" ? ". Goes into the Store." : ""
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
