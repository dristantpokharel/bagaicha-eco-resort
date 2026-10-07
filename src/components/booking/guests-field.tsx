"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/booking/stepper";
import { capacityNote, childAgeRange, partyLimits, partySummary, stepParty, type Party, type PartyField, type SeatPool } from "@/lib/booking/party";
import { PopoverSheet, triggerClasses, useIsWide } from "@/components/booking/popover-sheet";

type Props = {
  party: Party;
  onChange: (party: Party) => void;
  /** The selected room type's limits and room count, or every type's for "Any room". */
  pool: SeatPool;
  /** Name of the selected room type, for the capacity note. */
  typeName?: string;
  /** Children are younger than this (Business info); the label shows the range it implies. */
  childUnderAge: number;
  error?: string;
};

/** One "Guests" field ("2 adults · 0 children") opening −/+ steppers. Submits through two hidden inputs. */
export function GuestsField({ party, onChange, pool, typeName, childUnderAge, error }: Props) {
  const [open, setOpen] = useState(false);
  const wide = useIsWide();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  const limits = partyLimits(party, pool);
  const note = capacityNote(party, pool, typeName);

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const step = (field: PartyField, delta: 1 | -1) => onChange(stepParty(party, field, delta, pool));

  return (
    <div ref={rootRef} className="relative">
      <label id="guests-label" htmlFor="guests-trigger" className="mb-1.5 block text-sm font-medium text-charcoal">
        Guests
      </label>
      <input type="hidden" name="adults" value={party.adults} />
      <input type="hidden" name="children" value={party.children} />
      <button
        ref={triggerRef}
        id="guests-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-describedby={error ? "guests-error" : undefined}
        onClick={() => setOpen((o) => !o)}
        className={triggerClasses(Boolean(error))}
      >
        <span>{partySummary(party)}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0 text-forest" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      {error && (
        <p id="guests-error" className="mt-1 text-xs text-error">
          {error}
        </p>
      )}

      <PopoverSheet
        open={open}
        wide={wide}
        onClose={close}
        rootRef={rootRef}
        id={dialogId}
        labelledBy="guests-label"
        title="Guests"
        sheet="bottom"
        desktopClassName="left-0 w-80 max-w-[calc(100vw-2rem)]"
        footer={
          <Button type="button" variant="brand" size="lg" className="w-full" onClick={() => close()}>
            Done
          </Button>
        }
      >
        <div className="divide-y divide-forest/15">
          <StepperRow
            id="adults"
            label="Adults"
            value={party.adults}
            canDecrease={limits.canRemoveAdult}
            canIncrease={limits.canAddAdult}
            onStep={(d) => step("adults", d)}
          />
          <StepperRow
            id="children"
            label={`Children (${childAgeRange(childUnderAge)})`}
            value={party.children}
            canDecrease={limits.canRemoveChild}
            canIncrease={limits.canAddChild}
            onStep={(d) => step("children", d)}
          />
        </div>
        <p className="mt-3 min-h-4 text-xs text-ink-muted" aria-live="polite">
          {note}
        </p>
        {wide && (
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="secondary" size="md" onClick={() => close()}>
              Done
            </Button>
          </div>
        )}
      </PopoverSheet>
    </div>
  );
}

function StepperRow({
  id,
  label,
  value,
  canDecrease,
  canIncrease,
  onStep,
}: {
  id: string;
  label: string;
  value: number;
  canDecrease: boolean;
  canIncrease: boolean;
  onStep: (delta: 1 | -1) => void;
}) {
  const name = label.split(" (")[0].toLowerCase();
  return (
    <div className="flex items-center justify-between gap-4 py-3" role="group" aria-labelledby={`${id}-stepper-label`}>
      <div>
        <p id={`${id}-stepper-label`} className="text-sm font-medium text-ink-heading">
          {label}
        </p>
      </div>
      <Stepper value={value} canDecrease={canDecrease} canIncrease={canIncrease} onStep={onStep} noun={name} />
    </div>
  );
}
