"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MediaImage } from "@/components/media/media-image";
import type { PublicGalleryItem } from "@/lib/content/queries";

type Category = PublicGalleryItem["category"];

const LABELS: Record<Category, string> = {
  ROOMS: "Rooms",
  DINING: "Dining",
  ACTIVITIES: "Activities",
  EVENTS: "Events",
  PROPERTY: "Property",
};
const ORDER: Category[] = ["ROOMS", "DINING", "ACTIVITIES", "EVENTS", "PROPERTY"];

/** Masonry grid with category filters and a keyboard-accessible lightbox (a native modal dialog). */
export function Gallery({ items }: { items: PublicGalleryItem[] }) {
  const [filter, setFilter] = useState<"ALL" | Category>("ALL");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);

  const categories = ORDER.filter((c) => items.some((i) => i.category === c));
  const visible = useMemo(() => {
    const list = filter === "ALL" ? items : items.filter((i) => i.category === filter);
    // "All" shows each photo once even when it is filed under several categories.
    const seen = new Set<string>();
    return list.filter((i) => (seen.has(i.url) ? false : (seen.add(i.url), true)));
  }, [items, filter]);

  const open = (index: number, trigger: HTMLElement) => {
    lastTrigger.current = trigger;
    setOpenIndex(index);
  };
  const close = useCallback(() => dialogRef.current?.close(), []);
  const step = useCallback(
    (delta: number) => setOpenIndex((i) => (i === null ? i : (i + delta + visible.length) % visible.length)),
    [visible.length],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (openIndex !== null && !dialog.open) dialog.showModal();
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

  const current = openIndex === null ? null : visible[openIndex];

  return (
    <div>
      <div role="group" aria-label="Filter photos by category" className="flex flex-wrap gap-2">
        {(["ALL", ...categories] as const).map((c) => {
          const active = filter === c;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(c)}
              className={`min-h-11 px-5 font-label text-xs tracking-[0.18em] uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
                active ? "bg-forest text-cream" : "border border-ink/30 text-ink-heading hover:bg-sage"
              }`}
            >
              {c === "ALL" ? "All" : LABELS[c]}
            </button>
          );
        })}
      </div>
      <p className="sr-only" role="status">
        Showing {visible.length} photo{visible.length === 1 ? "" : "s"}
      </p>

      <ul className="mt-6 columns-1 gap-3 sm:columns-2 md:gap-4 lg:columns-3">
        {visible.map((item, i) => (
          <li key={item.id} className="mb-3 break-inside-avoid md:mb-4">
            <button
              type="button"
              onClick={(e) => open(i, e.currentTarget)}
              className="group relative block w-full overflow-hidden bg-sage focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              aria-label={`Open larger photo: ${item.altText || `photo ${i + 1}`}`}
            >
              <MediaImage
                media={{ ...item, altText: "" }}
                fill={false}
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="h-auto w-full transition-transform duration-700 ease-calm group-hover:scale-[1.02]"
              />
            </button>
          </li>
        ))}
      </ul>
      {visible.length === 0 && <p className="text-body mt-6">No photos in this category yet.</p>}

      <dialog
        ref={dialogRef}
        aria-label="Photo viewer"
        onClose={() => {
          setOpenIndex(null);
          lastTrigger.current?.focus();
        }}
        onClick={(e) => e.target === dialogRef.current && close()}
        className="m-0 h-svh max-h-none w-screen max-w-none bg-forest/95 p-0 text-cream backdrop:bg-transparent"
      >
        {current && (
          <div className="relative flex h-full flex-col">
            <div className="flex items-center justify-between px-4 py-3 md:px-8">
              <p className="text-label" aria-live="polite">
                {(openIndex ?? 0) + 1} / {visible.length}
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
            {visible.length > 1 && (
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
    </div>
  );
}
