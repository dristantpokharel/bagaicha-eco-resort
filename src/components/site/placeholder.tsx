/**
 * Visible marker for content the owner hasn't provided yet (AGENTS.md rule 5).
 * Never ship a page that renders this.
 */
export function Placeholder({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex max-w-full flex-wrap items-start gap-x-2 gap-y-0.5 border border-dashed border-warning bg-cream px-2.5 py-1.5 text-left font-label text-[0.6875rem] leading-snug font-medium tracking-wide text-warning ${className}`}
    >
      <span className="shrink-0 font-semibold uppercase">Dev placeholder</span>
      <span className="min-w-0 break-words normal-case">{children}</span>
    </span>
  );
}
