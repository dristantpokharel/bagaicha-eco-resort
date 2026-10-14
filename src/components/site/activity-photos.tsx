"use client";

import { useRef, useState } from "react";
import type { PublicMedia } from "@/lib/content/queries";
import { Lightbox } from "./lightbox";
import { MediaPhoto } from "./photo";

/** One to three photos for an activity; each opens the lightbox. The first is large, the rest sit beneath it. */
export function ActivityPhotos({ photos, title }: { photos: PublicMedia[]; title: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const [main, ...more] = photos;

  const open = (index: number, trigger: HTMLElement) => {
    lastTrigger.current = trigger;
    setOpenIndex(index);
  };
  const trigger = "block w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

  return (
    <div>
      <button type="button" onClick={(e) => open(0, e.currentTarget)} className={trigger} aria-label={`Open larger photo: ${main.altText || title}`}>
        <MediaPhoto media={main} sizes="(min-width: 768px) 40vw, 100vw" className="aspect-[4/3]" />
      </button>
      {more.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {more.map((m, i) => (
            <li key={m.url}>
              <button type="button" onClick={(e) => open(i + 1, e.currentTarget)} className={trigger} aria-label={`Open larger photo: ${m.altText || `${title}, photo ${i + 2}`}`}>
                <MediaPhoto media={m} sizes="(min-width: 768px) 20vw, 50vw" className="aspect-[4/3]" compact />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Lightbox items={photos} openIndex={openIndex} onChange={setOpenIndex} onClosed={() => lastTrigger.current?.focus()} />
    </div>
  );
}
