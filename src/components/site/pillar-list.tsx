"use client";

import Image from "next/image";
import { useState } from "react";

type Pillar = {
  word: string;
  line: string;
  href: string;
  image: { src: string; alt: string };
};

/**
 * Stay / Dine / Explore / Celebrate as a large editorial list rather than a card grid.
 * Desktop: hovering or focusing a row cross-fades the photo beside the list.
 * Phone: each row carries its own photo.
 */
export function PillarList({ pillars }: { pillars: readonly Pillar[] }) {
  const [active, setActive] = useState(0);

  return (
    <div className="grid items-center gap-10 md:grid-cols-[1fr_1.1fr] md:gap-16">
      <ul className="border-t border-ink/20">
        {pillars.map((p, i) => (
          <li key={p.word} className="border-b border-ink/20">
            <a
              href={p.href}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              className="group block py-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest md:py-8"
            >
              <span className="relative mb-5 block aspect-[4/3] overflow-hidden bg-sage md:hidden">
                <Image src={p.image.src} alt={p.image.alt} fill sizes="100vw" className="object-cover" />
              </span>
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
            </a>
          </li>
        ))}
      </ul>

      <div className="relative hidden aspect-[4/5] overflow-hidden bg-sage md:block" aria-hidden="true">
        {pillars.map((p, i) => (
          <Image
            key={p.word}
            src={p.image.src}
            alt=""
            fill
            sizes="(min-width: 768px) 50vw, 0px"
            className={`object-cover transition-opacity duration-700 ease-calm ${active === i ? "opacity-100" : "opacity-0"}`}
          />
        ))}
      </div>
    </div>
  );
}
