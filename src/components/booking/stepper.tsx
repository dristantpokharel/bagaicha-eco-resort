"use client";

type Props = {
  value: number;
  canDecrease: boolean;
  canIncrease: boolean;
  onStep: (delta: 1 | -1) => void;
  /** Lowercase noun for the accessible names: "adults" → "Fewer adults", "More adults", "2 adults". */
  noun: string;
};

const button =
  "flex size-11 items-center justify-center border border-forest/40 text-forest hover:bg-sage " +
  "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";

/** − value + control used by the guests field, the room quantities and the per-room guest counts. */
export function Stepper({ value, canDecrease, canIncrease, onStep, noun }: Props) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" className={button} disabled={!canDecrease} onClick={() => onStep(-1)} aria-label={`Fewer ${noun}`}>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M4 10h12" />
        </svg>
      </button>
      <output className="w-6 text-center text-base font-semibold text-ink" aria-live="polite" aria-label={`${value} ${noun}`}>
        {value}
      </output>
      <button type="button" className={button} disabled={!canIncrease} onClick={() => onStep(1)} aria-label={`More ${noun}`}>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M4 10h12M10 4v12" />
        </svg>
      </button>
    </div>
  );
}
