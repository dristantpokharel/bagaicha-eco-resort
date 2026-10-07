"use client";

import { useEffect, useState, type ReactNode } from "react";

const WIDE_QUERY = "(min-width: 640px)";

/** True from the `sm` breakpoint up. False on the server and first paint, so markup matches. */
export function useIsWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY);
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return wide;
}

/** Same look and height for every search control that opens a panel (and for the submit button beside them). */
export const CONTROL_HEIGHT = "min-h-14";
export const triggerClasses = (invalid = false) =>
  `flex ${CONTROL_HEIGHT} w-full items-center justify-between gap-3 border bg-white px-3 py-2 text-left text-sm text-charcoal ` +
  `focus-visible:border-forest ${invalid ? "border-error" : "border-ink/45"}`;

/**
 * A panel under its field on desktop; on phones a sheet over the page, either full screen or from the bottom.
 * Esc closes it, so does a click outside it on desktop. `onClose(returnFocus)` lets the owner put focus back on the trigger.
 */
export function PopoverSheet({
  open,
  wide,
  onClose,
  rootRef,
  id,
  labelledBy,
  title,
  sheet = "full",
  desktopClassName = "",
  footer,
  footerOnWide = false,
  dismissOnBackdrop = true,
  children,
}: {
  open: boolean;
  wide: boolean;
  onClose: (returnFocus: boolean) => void;
  /** The element holding trigger and panel; clicks inside it don't count as outside. */
  rootRef: React.RefObject<HTMLElement | null>;
  id: string;
  labelledBy: string;
  title: string;
  sheet?: "full" | "bottom";
  desktopClassName?: string;
  footer?: ReactNode;
  /** Show the footer under the panel on desktop too (it is always shown on phones). */
  footerOnWide?: boolean;
  /** Phones: tapping outside the sheet closes it. Off for the calendar, which closes only via Done or its close button. */
  dismissOnBackdrop?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose(true);
    const onPointer = (e: PointerEvent) => {
      if (wide && rootRef.current && !rootRef.current.contains(e.target as Node)) onClose(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    // Stop the page behind a phone sheet from scrolling.
    const previous = document.body.style.overflow;
    if (!wide) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      document.body.style.overflow = previous;
    };
  }, [open, wide, onClose, rootRef]);

  if (!open) return null;

  const phoneClasses =
    sheet === "full"
      ? "fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white"
      : "fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col overflow-y-auto border-t border-forest/20 bg-white shadow-elevated";

  return (
    <>
      {!wide && <div className="fixed inset-0 z-40 bg-forest/40" aria-hidden="true" onClick={dismissOnBackdrop ? () => onClose(true) : undefined} />}
      <div
        id={id}
        role="dialog"
        aria-modal={!wide}
        aria-labelledby={labelledBy}
        className={wide ? `absolute top-full z-40 mt-1 border border-forest/20 bg-white p-5 shadow-elevated ${desktopClassName}` : phoneClasses}
      >
        {!wide && (
          <div className="flex items-center justify-between border-b border-forest/15 px-4 py-3">
            <p className="font-label text-xs uppercase tracking-[0.14em] text-ink-heading">{title}</p>
            <button type="button" onClick={() => onClose(true)} className="flex size-11 items-center justify-center text-forest" aria-label={`Close ${title.toLowerCase()}`}>
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4l12 12M16 4L4 16" />
              </svg>
            </button>
          </div>
        )}
        <div className={wide ? "" : "flex-1 px-4 py-3"}>{children}</div>
        {!wide && footer && <div className="sticky bottom-0 border-t border-forest/15 bg-white p-4">{footer}</div>}
        {wide && footer && footerOnWide && <div className="mt-4 border-t border-forest/15 pt-3">{footer}</div>}
      </div>
    </>
  );
}
