"use client";

import Link from "next/link";
import { useState } from "react";
import { MediaImage, type MediaImageData } from "@/components/media/media-image";

type Pillar = {
  word: string;
  line: string;
  href: string;
  image: MediaImageData | null;
};

/**
 * Stay / Dine / Explore / Celebrate as a large editorial list rather than a card grid.
 * Desktop: hovering or focusing a row cross-fades the photo beside the list.
 * Phone: each row carries its own photo.
 */
export function PillarList({ pillars }: { pillars: readonly Pillar[] }) {
  const [active, setActive] = useState(0);
  const hasImages = pillars.some((p) => p.image);

  return (
    <div className={`grid items-center gap-8 md:gap-16 ${hasImages ? "md:grid-cols-[1fr_1.1fr]" : ""}`}>
      <ul className="border-t border-ink/20">
        {pillars.map((p, i) => (
          <li key={p.word} className="border-b border-ink/20">
            <Link
              href={p.href}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              className="group block py-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest md:py-8"
            >
              {p.image && (
                <span className="relative mb-4 block aspect-[4/3] overflow-hidden bg-sage md:hidden">
                  <MediaImage media={p.image} sizes="100vw" className="object-cover" />
                </span>
              )}
              <span className="flex items-baseline justify-between gap-4">
                <span
                  className={`font-display text-[clamp(2.5rem,5vw,4rem)] leading-none font-bold italic transition-colors duration-500 ${
                    active === i ? "text-ink-heading" : "text-ink-heading md:text-ink-muted"
                  } group-hover:text-ink-heading`}
                >
                  {p.word}
                </span>
                <span className="text-label text-ink-muted" aria-hidden="true">
                  0{i + 1}
                </span>
              </span>
              <span className="mt-3 block max-w-md text-body text-ink">{p.line}</span>
            </Link>
          </li>
        ))}
      </ul>

      {hasImages && (
        <div className="relative hidden aspect-[4/5] overflow-hidden bg-sage md:block" aria-hidden="true">
          {pillars.map((p, i) =>
            p.image ? (
              <MediaImage
                key={p.word}
                media={p.image}
                alt=""
                sizes="(min-width: 768px) 50vw, 0px"
                className={`object-cover transition-opacity duration-700 ease-calm ${active === i ? "opacity-100" : "opacity-0"}`}
              />
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
