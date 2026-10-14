"use client";

import { useMemo, useRef, useState } from "react";
import { MediaImage } from "@/components/media/media-image";
import type { PublicGalleryItem } from "@/lib/content/queries";
import { Lightbox } from "./lightbox";

type Category = PublicGalleryItem["category"];

const LABELS: Record<Category, string> = {
  ROOMS: "Rooms",
  DINING: "Dining",
  ACTIVITIES: "Activities",
  EVENTS: "Events",
  PROPERTY: "Property",
  SURROUNDINGS: "Surroundings",
};
const ORDER: Category[] = ["ROOMS", "DINING", "ACTIVITIES", "EVENTS", "PROPERTY", "SURROUNDINGS"];

/** Masonry grid with category filters and a keyboard-accessible lightbox (a native modal dialog). */
export function Gallery({ items }: { items: PublicGalleryItem[] }) {
  const [filter, setFilter] = useState<"ALL" | Category>("ALL");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
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
              {item.isPlaceholder && (
                <span className="absolute top-2 left-2 z-10 bg-cream px-2 py-1 font-label text-[0.6875rem] font-medium text-warning">
                  DEV PLACEHOLDER: {item.placeholderNote ?? "rights unconfirmed"}
                </span>
              )}
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

      <Lightbox items={visible} openIndex={openIndex} onChange={setOpenIndex} onClosed={() => lastTrigger.current?.focus()} />
    </div>
  );
}
