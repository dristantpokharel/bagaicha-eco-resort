"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionMessage } from "@/components/ui/action-message";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import type { ActionResult } from "@/lib/actions";
import { formatQuantityWithUnit } from "@/lib/inventory/format";
import { newSubmissionId } from "@/lib/inventory/submission-id";
import { NOTE_MAX_LENGTH } from "@/lib/inventory/schemas";
import { moveStock, writeOffItem } from "./actions";

export type PlaceItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: string;
  /** Amount at each location id (missing = 0). */
  balances: Record<string, string>;
};

export type Place = { id: string; label: string; isActive: boolean };

/**
 * Moves reusable stock between places, or writes off lost / damaged stock.
 * Phone-first like MovementForm: big tap targets, 16px text, one token per attempt.
 */
export function PlaceForm({
  mode,
  items,
  places,
  defaultItemId,
  defaultFromId,
}: {
  mode: "move" | "writeoff";
  items: PlaceItem[];
  places: Place[];
  defaultItemId?: string;
  defaultFromId?: string;
}) {
  const [itemId, setItemId] = useState(defaultItemId ?? "");
  const [search, setSearch] = useState("");
  const [fromId, setFromId] = useState(defaultFromId ?? "");
  const [toId, setToId] = useState("");
  const [kind, setKind] = useState<"LOST" | "DAMAGED">("DAMAGED");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const submissionId = useRef<string | null>(null);

  const [result, action, pending] = useActionState<ActionResult | null, FormData>(async (prev, formData) => {
    submissionId.current ??= newSubmissionId();
    formData.set("submissionId", submissionId.current);
    let outcome: ActionResult;
    try {
      outcome = await (mode === "move" ? moveStock : writeOffItem)(prev, formData);
    } catch {
      return {
        ok: false,
        error:
          "Couldn't reach the server, so we can't tell if this was saved. Check your connection and tap the button again: it won't be saved twice.",
      };
    }
    if (outcome.ok) {
      submissionId.current = null;
      setQuantity("");
      setNote("");
      setSearch("");
      setItemId("");
      setFromId("");
      setToId("");
    }
    return outcome;
  }, null);
  const errors = result && !result.ok ? result.fieldErrors : undefined;

  const item = items.find((candidate) => candidate.id === itemId);
  const term = search.trim().toLowerCase();
  const shown = term ? items.filter((candidate) => `${candidate.name} ${candidate.category}`.toLowerCase().includes(term)) : items;
  const balanceAt = (placeId: string) => item?.balances[placeId] ?? "0";
  // Sources are where the item actually sits; destinations are any active place except the source.
  const sources = item ? places.filter((place) => balanceAt(place.id) !== "0") : [];
  const destinations = places.filter((place) => place.isActive && place.id !== fromId);
  const fromBalance = item && fromId ? balanceAt(fromId) : null;

  function pick(id: string) {
    setItemId(id);
    const next = items.find((candidate) => candidate.id === id);
    const where = next ? places.filter((place) => (next.balances[place.id] ?? "0") !== "0") : [];
    setFromId(where.length === 1 ? where[0].id : "");
  }

  const label = mode === "move" ? "Move" : kind === "LOST" ? "Write off as lost" : "Write off as damaged";

  return (
    <form action={action} className="space-y-5" noValidate>
      <ActionMessage result={result} />

      {mode === "writeoff" && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-charcoal">What happened?</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["DAMAGED", "LOST"] as const).map((option) => (
              <label
                key={option}
                className={`flex min-h-12 cursor-pointer items-center justify-center rounded-md border px-3 text-base font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-forest ${
                  kind === option ? "border-forest bg-forest text-cream" : "border-charcoal/25 bg-white text-charcoal"
                }`}
              >
                <input type="radio" name="kind" value={option} checked={kind === option} onChange={() => setKind(option)} className="sr-only" />
                {option === "DAMAGED" ? "Damaged" : "Lost / missing"}
              </label>
            ))}
          </div>
        </fieldset>
      )}

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
        <div className="max-h-64 overflow-y-auto rounded-md border border-charcoal/25 bg-white" aria-live="polite">
          {shown.length === 0 && <p className="px-3 py-3 text-sm text-charcoal-light">No reusable items match.</p>}
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
                onChange={() => pick(candidate.id)}
                className="sr-only"
              />
              <span className="text-base">
                {candidate.name}
                <span className="block text-xs text-charcoal-light">{candidate.category}</span>
              </span>
              <span className="text-sm whitespace-nowrap text-charcoal-light">{formatQuantityWithUnit(candidate.quantity, candidate.unit)}</span>
            </label>
          ))}
        </div>
        {errors?.itemId && <p className="mt-1 text-xs text-error">{errors.itemId}</p>}
      </fieldset>

      <div className={mode === "move" ? "grid gap-4 sm:grid-cols-2" : ""}>
        <Field
          id="place-from"
          label={mode === "move" ? "From" : "Where from?"}
          error={errors?.fromLocationId}
          hint={item && sources.length === 0 ? "None of this item is in any place yet. Receive it into the Store first." : undefined}
        >
          <Select id="place-from" name="fromLocationId" value={fromId} onChange={(event) => setFromId(event.target.value)} className="min-h-12" disabled={!item}>
            <option value="">{item ? "Choose…" : "Choose an item first"}</option>
            {sources.map((place) => (
              <option key={place.id} value={place.id}>
                {place.label} ({formatQuantityWithUnit(balanceAt(place.id), item!.unit)})
              </option>
            ))}
          </Select>
        </Field>
        {mode === "move" && (
          <Field id="place-to" label="To" error={errors?.toLocationId}>
            <Select id="place-to" name="toLocationId" value={toId} onChange={(event) => setToId(event.target.value)} className="min-h-12" disabled={!fromId}>
              <option value="">Choose…</option>
              {destinations.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      <Field
        id="place-quantity"
        label="Amount"
        error={errors?.quantity}
        hint={item && fromBalance !== null ? `Available there: ${formatQuantityWithUnit(fromBalance, item.unit)}` : undefined}
      >
        <div className="flex items-center gap-2">
          <Input
            id="place-quantity"
            name="quantity"
            inputMode="decimal"
            autoComplete="off"
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="min-h-12"
            aria-invalid={errors?.quantity ? true : undefined}
          />
          {item && <span className="text-base text-charcoal">{item.unit}</span>}
        </div>
      </Field>

      <Field
        id="place-note"
        label={mode === "writeoff" ? "What happened? (required)" : "Note (optional)"}
        error={errors?.note}
      >
        <Textarea
          id="place-note"
          name="note"
          rows={2}
          maxLength={NOTE_MAX_LENGTH}
          required={mode === "writeoff"}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          aria-invalid={errors?.note ? true : undefined}
        />
      </Field>

      <Button type="submit" size="md" className="min-h-12 w-full sm:w-auto" disabled={pending || !itemId || !fromId || (mode === "move" && !toId)}>
        {pending ? "Saving…" : label}
      </Button>
    </form>
  );
}
