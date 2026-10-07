"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/booking/stepper";
import { PopoverSheet, triggerClasses, useIsWide } from "@/components/booking/popover-sheet";
import type { Party } from "@/lib/booking/capacity";
import { describeCapacityCompact, type Capacity } from "@/lib/booking/capacity";
import { childAgeRange, guestLimits, guestNote, guestsSummary, largestCapacity, stepGuests } from "@/lib/booking/room-builder";

type Props = {
  roomNumber: number;
  party: Party;
  onChange: (party: Party) => void;
  /** The chosen type's limits, or every type's while the room has no type yet. */
  caps: Capacity[];
  /** Name of the chosen type, for the note under the steppers. */
  typeName?: string;
  /** Children are younger than this (Business info); the label shows the range it implies. */
  childUnderAge: number;
};

/** One room's guests ("2 adults · 0 children") opening −/+ steppers; a popover on desktop, a bottom sheet on phones. */
export function RoomGuestsField({ roomNumber, party, onChange, caps, typeName, childUnderAge }: Props) {
  const [open, setOpen] = useState(false);
  const wide = useIsWide();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const labelId = `${id}-label`;
  const limits = guestLimits(party, caps);
  const note = guestNote(party, caps, typeName);
  const capacity = describeCapacityCompact(largestCapacity(caps));

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };
  const step = (field: keyof Party, delta: 1 | -1) => onChange(stepGuests(party, field, delta, caps));

  return (
    <div ref={rootRef} className="relative">
      <label id={labelId} htmlFor={`${id}-trigger`} className="mb-1.5 block text-sm font-medium text-charcoal lg:sr-only">
        Guests
      </label>
      <button
        ref={triggerRef}
        id={`${id}-trigger`}
        type="button"
        aria-label={`Guests in room ${roomNumber}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`${triggerClasses()} lg:min-h-19!`}
      >
        <span>{guestsSummary(party)}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0 text-forest" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>

      <PopoverSheet
        open={open}
        wide={wide}
        onClose={close}
        rootRef={rootRef}
        id={id}
        labelledBy={labelId}
        title={`Guests in room ${roomNumber}`}
        sheet="bottom"
        desktopClassName="left-0 w-80 max-w-[calc(100vw-2rem)]"
        footer={
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-ink-muted">{capacity}</p>
            <Button type="button" variant="brand" size="lg" onClick={() => close()}>
              Done
            </Button>
          </div>
        }
      >
        <div className="divide-y divide-forest/15">
          <StepperRow label="Adults" noun="adults" value={party.adults} canDecrease={limits.canRemoveAdult} canIncrease={limits.canAddAdult} onStep={(d) => step("adults", d)} />
          <StepperRow
            label={`Children (${childAgeRange(childUnderAge)})`}
            noun="children"
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
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-sm text-ink-muted">{capacity}</p>
            <Button type="button" variant="secondary" size="md" onClick={() => close()}>
              Done
            </Button>
          </div>
        )}
      </PopoverSheet>
    </div>
  );
}

function StepperRow({ label, noun, value, canDecrease, canIncrease, onStep }: { label: string; noun: string; value: number; canDecrease: boolean; canIncrease: boolean; onStep: (delta: 1 | -1) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <p className="text-sm font-medium text-ink-heading">{label}</p>
      <Stepper value={value} canDecrease={canDecrease} canIncrease={canIncrease} onStep={onStep} noun={noun} />
    </div>
  );
}
