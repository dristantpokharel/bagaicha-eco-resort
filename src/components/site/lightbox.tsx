"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { MediaImage, type MediaImageData } from "@/components/media/media-image";

/**
 * Full-screen photo viewer (a native modal dialog). The caller owns `openIndex` (null = closed)
 * and is told when it changes; `onClosed` runs after the dialog has closed, e.g. to restore focus.
 */
export function Lightbox({
  items,
  openIndex,
  onChange,
  onClosed,
}: {
  items: MediaImageData[];
  openIndex: number | null;
  onChange: (index: number | null) => void;
  onClosed?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = useCallback(() => dialogRef.current?.close(), []);
  const step = useCallback(
    (delta: number) => onChange(openIndex === null ? null : (openIndex + delta + items.length) % items.length),
    [items.length, onChange, openIndex],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && openIndex !== null && !dialog.open) dialog.showModal();
  }, [openIndex]);

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, step]);

  const current = openIndex === null ? null : items[openIndex];

  return (
    <dialog
      ref={dialogRef}
      aria-label="Photo viewer"
      onClose={() => {
        onChange(null);
        onClosed?.();
      }}
      onClick={(e) => e.target === dialogRef.current && close()}
      className="m-0 h-svh max-h-none w-screen max-w-none bg-forest/95 p-0 text-cream backdrop:bg-transparent"
    >
      {current && (
        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-3 md:px-8">
            <p className="text-label" aria-live="polite">
              {(openIndex ?? 0) + 1} / {items.length}
            </p>
            <button type="button" onClick={close} className="inline-flex size-12 items-center justify-center focus-visible:outline-2 focus-visible:outline-cream" autoFocus>
              <X aria-hidden="true" />
              <span className="sr-only">Close</span>
            </button>
          </div>
          <div className="relative min-h-0 flex-1">
            <MediaImage media={current} sizes="100vw" className="object-contain" />
          </div>
          {current.altText && <p className="px-4 py-3 text-center text-sm md:px-8">{current.altText}</p>}
          {items.length > 1 && (
            <>
              <button type="button" onClick={() => step(-1)} className="absolute top-1/2 left-1 inline-flex size-12 -translate-y-1/2 items-center justify-center bg-forest/70 focus-visible:outline-2 focus-visible:outline-cream md:left-4">
                <ChevronLeft aria-hidden="true" />
                <span className="sr-only">Previous photo</span>
              </button>
              <button type="button" onClick={() => step(1)} className="absolute top-1/2 right-1 inline-flex size-12 -translate-y-1/2 items-center justify-center bg-forest/70 focus-visible:outline-2 focus-visible:outline-cream md:right-4">
                <ChevronRight aria-hidden="true" />
                <span className="sr-only">Next photo</span>
              </button>
            </>
          )}
        </div>
      )}
    </dialog>
  );
}
