"use client";

import { Input } from "@/components/ui/form";

/** − / number / + with 44px targets, for counting things on a phone. Clamped to 0..max. */
export function Stepper({
  name,
  value,
  max,
  onChange,
  disabled,
  label,
}: {
  name: string;
  value: string;
  max: number;
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
}) {
  const current = Number(value);
  const set = (next: number) => onChange(String(Math.min(max, Math.max(0, Number.isFinite(next) ? next : 0))));
  const button =
    "flex size-11 items-center justify-center rounded-md border border-forest/30 bg-white text-xl text-forest disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-forest";
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={button} aria-label={`One less ${label}`} disabled={disabled || current <= 0} onClick={() => set(current - 1)}>
        −
      </button>
      <Input
        name={name}
        aria-label={`Amount of ${label}`}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-16 text-center"
      />
      <button type="button" className={button} aria-label={`One more ${label}`} disabled={disabled || current >= max} onClick={() => set(current + 1)}>
        +
      </button>
    </div>
  );
}
