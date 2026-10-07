"use client";

import { useId, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { BOOKING } from "@/config/booking";
import { Button } from "@/components/ui/button";
import { addDays, describeRange, formatCompactDate, nightsBetween, parseDateOnly, toDateOnlyString } from "@/lib/booking/dates";
import { latestCheckOut } from "@/lib/booking/availability-map";
import { PopoverSheet, triggerClasses, useIsWide } from "@/components/booking/popover-sheet";

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

/**
 * One "Check-in → Check-out" field that opens a range calendar. Controlled by
 * the search form; submits through two hidden inputs so /book stays a plain GET form.
 */
export function DateRangeField({ today, checkIn, checkOut, onChange, soldOut, error, notice }: Props) {
  const [open, setOpen] = useState(false);
  const wide = useIsWide();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();

  const todayDate = parseDateOnly(today) as Date;
  const horizon = addDays(todayDate, BOOKING.maxDaysAhead);
  const inDate = parseDateOnly(checkIn);
  const outDate = parseDateOnly(checkOut);
  // Picking the check-out: a check-in is set and the check-out isn't (yet).
  const [anchor, setAnchor] = useState<Date | null>(null);
  // The day under the pointer or keyboard focus while choosing a check-out: the range previews up to it.
  const [hover, setHover] = useState<Date | null>(null);

  const close = (returnFocus = true) => {
    setOpen(false);
    setAnchor(null);
    setHover(null);
    if (returnFocus) triggerRef.current?.focus();
  };

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
    setHover(null);
    if (anchor && d > anchor) {
      // The calendar stays open: the footer shows the stay and Done closes it.
      onChange(toDateOnlyString(anchor), toDateOnlyString(d));
      setAnchor(null);
    } else if (anchor && d.getTime() === anchor.getTime()) {
      setAnchor(null);
      onChange("", "");
    } else {
      setAnchor(d);
      onChange(toDateOnlyString(d), "");
    }
  }

  const nights = inDate && outDate ? nightsBetween(inDate, outDate) : 0;
  const preview = anchor && hover && hover > anchor && !isDisabled(hover) ? { from: anchor, to: hover } : null;
  const shown: DateRange | undefined = preview ?? (inDate ? { from: inDate, to: outDate ?? undefined } : undefined);
  const prompt = inDate && outDate ? describeRange(inDate, outDate) : inDate ? "Now choose your check-out date" : "Choose your check-in date";
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
        className={triggerClasses(Boolean(error))}
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

      <PopoverSheet
        open={open}
        wide={wide}
        onClose={close}
        rootRef={rootRef}
        id={dialogId}
        labelledBy="dates-label"
        title="Select your dates"
        desktopClassName="left-0 w-max max-w-[calc(100vw-2rem)]"
        footerOnWide
        dismissOnBackdrop={false}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-sm text-ink" aria-live="polite">
              {prompt}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={!inDate}
                onClick={() => {
                  setAnchor(null);
                  setHover(null);
                  onChange("", "");
                }}
              >
                Clear
              </Button>
              <Button type="button" variant="brand" size="md" onClick={() => close()}>
                Done
              </Button>
            </div>
          </div>
        }
      >
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
          // `selected` only follows our state when the picker is controlled (it has an onSelect); onDayClick does the picking.
          onSelect={() => undefined}
          onDayClick={pick}
          onDayMouseEnter={(d) => setHover(d)}
          onDayMouseLeave={() => setHover(null)}
          onDayFocus={(d) => setHover(d)}
          onDayBlur={() => setHover(null)}
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
      </PopoverSheet>
    </div>
  );
}
