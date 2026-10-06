"use client";

import { useState } from "react";

export type TitleFont = { id: string; label: string; family: string; note: string };

/**
 * DEV ONLY (Phase 1.5): lets the owner compare Seravek stand-ins on the real page.
 * Overrides --font-display for everything inside it. Removed once a font is chosen.
 */
export function TitleFontSwitcher({ fonts, children }: { fonts: readonly TitleFont[]; children: React.ReactNode }) {
  const [current, setCurrent] = useState(fonts[0].id);
  const font = fonts.find((f) => f.id === current) ?? fonts[0];

  return (
    <div style={{ "--font-display": font.family } as React.CSSProperties} className="flex min-h-full flex-col">
      {children}
      <div
        role="group"
        aria-label="Title font (design preview)"
        className="fixed right-2 bottom-2 z-50 flex items-center gap-1.5 border border-dashed border-warning bg-cream p-1.5 font-label text-xs text-ink sm:gap-2 sm:p-2"
      >
        <span className="px-1 font-semibold tracking-wide text-warning uppercase">
          <span className="max-sm:sr-only">Preview · Title </span>Font
        </span>
        {fonts.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={f.id === current}
            aria-label={f.label}
            onClick={() => setCurrent(f.id)}
            className="min-h-10 border border-forest/30 px-2 aria-pressed:bg-forest aria-pressed:text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest sm:px-3"
            style={{ fontFamily: f.family, fontStyle: "italic", fontWeight: 700, fontSize: "0.95rem" }}
          >
            <span className="max-sm:hidden">{f.label}</span>
            <span className="sm:hidden">{f.label.split(" ")[0]}</span>
          </button>
        ))}
        <a href="#font-compare" className="px-1 underline underline-offset-4 max-sm:hidden">
          Compare
        </a>
      </div>
    </div>
  );
}
