/** Brochure motifs (docs/design-tokens.md §4). All purely decorative: aria-hidden. */

/**
 * Two-layer organic wave: a thin olive band riding on forest.
 * `position="top"` sits on top of a forest section; "bottom" flips it to close one.
 */
export function Wave({ position = "top", className = "" }: { position?: "top" | "bottom"; className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={`block h-14 w-full md:h-24 ${position === "bottom" ? "rotate-180" : ""} ${className}`}
    >
      <path className="fill-olive" d="M0 62C220 22 470 18 720 48s520 70 720 4v68H0z" />
      <path className="fill-forest" d="M0 80c230-34 480-38 740-12s500 56 700 6v46H0z" />
    </svg>
  );
}

/** Soft sage blob that bleeds off an edge, behind a pull quote. */
export function SageBlob({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 500" preserveAspectRatio="none" aria-hidden="true" className={`fill-sage ${className}`}>
      <path d="M118 40C214-6 372 6 470 54c98 48 140 150 126 250-14 98-86 176-190 192-104 16-230-30-318-102C0 322-24 226 20 156 52 104 64 66 118 40z" />
    </svg>
  );
}

/** Leaf sprig: a curved stem with alternating leaves, tucked into page corners. */
export function LeafSprig({ className = "" }: { className?: string }) {
  const leaves = [
    { x: 40, y: 150, r: -140 },
    { x: 62, y: 120, r: -30 },
    { x: 78, y: 92, r: -150 },
    { x: 100, y: 66, r: -20 },
    { x: 118, y: 44, r: -140 },
    { x: 142, y: 26, r: -40 },
  ];
  return (
    <svg viewBox="0 0 180 180" aria-hidden="true" className={`text-leaf ${className}`}>
      <path d="M10 178C40 140 90 70 170 12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      {leaves.map((l) => (
        <g key={`${l.x}-${l.y}`} transform={`translate(${l.x} ${l.y}) rotate(${l.r})`}>
          <path d="M0 0C10-14 34-16 50 0 34 16 10 14 0 0z" fill="currentColor" />
          <path d="M4 0h40" stroke="var(--color-cream)" strokeOpacity=".35" strokeWidth="1.2" />
        </g>
      ))}
    </svg>
  );
}
