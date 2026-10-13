"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * How the dialog sits: a sheet from the bottom edge, the whole screen, or (on phones the whole screen, from
 * `md` up) a centred panel near the top, like a command palette.
 */
type Placement = "bottom" | "full" | "palette";

const PLACEMENT: Record<Placement, string> = {
  bottom: "fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none rounded-t-xl",
  full: "fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none",
  palette:
    "fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none md:inset-x-0 md:top-[10vh] md:mx-auto md:h-auto md:max-h-[70vh] md:max-w-xl md:rounded-lg",
};

/**
 * A modal built on the native <dialog>: focus is trapped, the page behind is inert, Esc and the backdrop close
 * it. Children are only mounted while open, so their state resets on every opening.
 */
export function Sheet({
  open,
  onClose,
  label,
  placement = "bottom",
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Accessible name of the dialog. */
  label: string;
  placement?: Placement;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Stop the page behind from scrolling while a sheet is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      // A click on the dialog element itself is a click on the backdrop; the content div fills the rest.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={`${PLACEMENT[placement]} overflow-hidden border-0 bg-white p-0 text-charcoal shadow-elevated backdrop:bg-black/40 ${className}`}
    >
      {open && <div className="flex h-full max-h-[inherit] min-h-0 flex-col">{children}</div>}
    </dialog>
  );
}
