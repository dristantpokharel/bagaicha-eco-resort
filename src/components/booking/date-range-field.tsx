"use client";

import { useEffect, useId, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { BOOKING } from "@/config/booking";
import { Button } from "@/components/ui/button";
import { addDays, formatCompactDate, nightsBetween, parseDateOnly, toDateOnlyString } from "@/lib/booking/dates";
import { latestCheckOut } from "@/lib/booking/availability-map";

type Props = {
  /** Today in the resort (ISO date). */
  today: string;
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
  /** Nights to show as sold out (already filtered for room type and party). */
  soldOut: Set<string>;
  error?: string;
  /** Shown under the field, e.g. when the dates cross a sold-out night. */
  notice?: string;
};

const WIDE_QUERY = "(min-width: 640px)";

/**
 * One "Check-in → Check-out" field that opens a range calendar. Controlled by
 * the search form; submits through two hidden inputs so /book stays a plain GET form.
 */
export function DateRangeField({ today, checkIn, checkOut, onChange, soldOut, error, notice }: Props) {
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();

  const todayDate = parseDateOnly(today) as Date;
  const horizon = addDays(todayDate, BOOKING.maxDaysAhead);
  const inDate = parseDateOnly(checkIn);
  const outDate = parseDateOnly(checkOut);
  // Picking the check-out: a check-in is set and the check-out isn't (yet).
  const [anchor, setAnchor] = useState<Date | null>(null);

  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  function close(returnFocus = true) {
    setOpen(false);
    setAnchor(null);
    if (returnFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onPointer = (e: PointerEvent) => {
      if (wide && rootRef.current && !rootRef.current.contains(e.target as Node)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    // Stop the page behind the full-screen phone sheet from scrolling.
    const previous = document.body.style.overflow;
    if (!wide) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      document.body.style.overflow = previous;
    };
  }, [open, wide]);

  const isSoldOut = (d: Date) => soldOut.has(toDateOnlyString(d));
  const maxCheckOut = anchor ? latestCheckOut(soldOut, anchor, BOOKING.maxNights, horizon) : null;

  /** Picking a check-in: not in the past, not beyond the horizon, not a sold-out night. Picking a check-out: after the anchor and no later than maxCheckOut. */
  function isDisabled(d: Date) {
    if (d < todayDate || d > horizon) return true;
    if (anchor && d > anchor) return d > (maxCheckOut as Date);
    return isSoldOut(d);
  }

  function pick(d: Date) {
    if (isDisabled(d)) return;
    if (anchor && d > anchor) {
      onChange(toDateOnlyString(anchor), toDateOnlyString(d));
      close();
    } else if (anchor && d.getTime() === anchor.getTime()) {
      setAnchor(null);
      onChange("", "");
    } else {
      setAnchor(d);
      onChange(toDateOnlyString(d), "");
    }
  }

  const nights = inDate && outDate ? nightsBetween(inDate, outDate) : 0;
  const shown: DateRange | undefined = inDate ? { from: inDate, to: outDate ?? undefined } : undefined;
  const label =
    inDate && outDate
      ? `${formatCompactDate(inDate)} → ${formatCompactDate(outDate)} · ${nights} night${nights === 1 ? "" : "s"}`
      : inDate
        ? `${formatCompactDate(inDate)} → Check-out`
        : null;

  const startMonth = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(horizon.getUTCFullYear(), horizon.getUTCMonth(), 1));
  const describedBy = [error ? "dates-error" : null, notice ? "dates-notice" : null].filter(Boolean).join(" ") || undefined;

  return (
    <div ref={rootRef} className="relative">
      <label id="dates-label" htmlFor="dates-trigger" className="mb-1.5 block text-sm font-medium text-charcoal">
        Check-in → Check-out
      </label>
      <input type="hidden" name="checkIn" value={checkIn} />
      <input type="hidden" name="checkOut" value={checkOut} />
      <button
        ref={triggerRef}
        id="dates-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-describedby={describedBy}
        onClick={() => {
          setAnchor(inDate && !outDate ? inDate : null);
          setOpen((o) => !o);
        }}
        className={`flex min-h-12 w-full items-center justify-between gap-3 border border-ink/45 bg-white px-3 py-2 text-left text-sm text-charcoal focus-visible:border-forest ${error ? "border-error" : ""}`}
      >
        <span className={label ? "" : "text-charcoal-light"}>{label ?? "Select your dates"}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0 text-forest" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4.5" width="14" height="12.5" rx="1" />
          <path d="M3 8.5h14M7 2.5v4M13 2.5v4" />
        </svg>
      </button>
      {error && (
        <p id="dates-error" className="mt-1 text-xs text-error">
          {error}
        </p>
      )}
      {notice && (
        <p id="dates-notice" className="mt-1 text-xs text-warning" role="status">
          {notice}
        </p>
      )}

      {open && (
        <>
          {!wide && <div className="fixed inset-0 z-40 bg-forest/40" aria-hidden="true" />}
          <div
            id={dialogId}
            role="dialog"
            aria-modal={!wide}
            aria-labelledby="dates-label"
            className={
              wide
                ? "absolute left-0 top-full z-40 mt-1 w-max max-w-[calc(100vw-2rem)] border border-forest/20 bg-white p-5 shadow-elevated"
                : "fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white"
            }
          >
            {!wide && (
              <div className="flex items-center justify-between border-b border-forest/15 px-4 py-3">
                <p className="font-label text-xs uppercase tracking-[0.14em] text-ink-heading">Select your dates</p>
                <button type="button" onClick={() => close()} className="flex size-11 items-center justify-center text-forest" aria-label="Close calendar">
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 4l12 12M16 4L4 16" />
                  </svg>
                </button>
              </div>
            )}
            <div className={wide ? "" : "flex-1 px-4 py-3"}>
              <p className="mb-2 text-sm text-ink-muted" aria-live="polite">
                {anchor ? "Now choose your check-out date." : "Choose your check-in date."}
              </p>
              <DayPicker
                className="dp"
                mode="range"
                timeZone="UTC"
                weekStartsOn={0}
                numberOfMonths={wide ? 2 : 1}
                startMonth={startMonth}
                endMonth={endMonth}
                defaultMonth={inDate ?? todayDate}
                today={todayDate}
                selected={shown}
                onDayClick={pick}
                disabled={isDisabled}
                modifiers={{ soldOut: isSoldOut }}
                modifiersClassNames={{ soldOut: "dp-soldout" }}
                autoFocus
                labels={{
                  labelDayButton: (date, modifiers) => {
                    const text = formatCompactDate(date);
                    if (modifiers.soldOut) return modifiers.disabled ? `${text}, sold out` : `${text}, sold out, check-out only`;
                    if (modifiers.today) return `${text}, today`;
                    return text;
                  },
                }}
              />
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink" aria-label="Legend">
                <li className="flex items-center gap-2">
                  <span aria-hidden="true" className="inline-block size-4 border border-ink/30 bg-white" /> Available
                </li>
                <li className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block size-4 border border-ink/30"
                    style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 3px, rgba(63,68,48,0.35) 3px 4px)" }}
                  />
                  <s>Sold out</s>
                </li>
                <li className="flex items-center gap-2">
                  <span aria-hidden="true" className="inline-block size-4 bg-forest" /> Selected
                </li>
              </ul>
            </div>
            {!wide && (
              <div className="sticky bottom-0 border-t border-forest/15 bg-white p-4">
                <Button type="button" variant="brand" size="lg" className="w-full" onClick={() => close()}>
                  {label && outDate ? "Done" : "Close"}
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
