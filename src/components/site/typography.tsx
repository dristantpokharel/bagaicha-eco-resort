/** Brochure heading system (docs/design-tokens.md §3): bold italic line, light italic line, short rule. */

type HeadingProps = {
  strong?: string;
  soft?: string;
  /** "a **stay**" style: small light lead word + heavy accent word on line one */
  lead?: string;
  accent?: string;
  as?: "h1" | "h2" | "h3";
  id?: string;
  tone?: "dark" | "light";
  rule?: boolean;
  className?: string;
};

export function SectionHeading({
  strong,
  soft,
  lead,
  accent,
  as: Tag = "h2",
  id,
  tone = "dark",
  rule = true,
  className = "",
}: HeadingProps) {
  const color = tone === "dark" ? "text-ink-heading" : "text-cream";
  return (
    <div className={`${color} ${className}`}>
      <Tag id={id}>
        {accent ? (
          <span className="block font-display italic leading-none">
            {lead ? <span className="text-heading-soft">{lead} </span> : null}
            <span className="text-[clamp(3rem,7vw,5rem)] font-black">{accent}</span>
          </span>
        ) : null}
        {strong ? <span className="text-heading-strong block">{strong}</span> : null}
        {soft ? <span className="text-heading-soft mt-1 block">{soft}</span> : null}
      </Tag>
      {rule ? <span className="rule-short mt-6" aria-hidden="true" /> : null}
    </div>
  );
}

/** Stacked three-word kicker ("RELAX / RECONNECT / BELONG") with a short rule. */
export function Kicker({ words, tone = "dark" }: { words: readonly string[]; tone?: "dark" | "light" }) {
  return (
    <div className={tone === "dark" ? "text-ink" : "text-cream"}>
      <ul className="text-kicker" aria-label={words.join(", ")}>
        {words.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      <span className="rule-short mt-3" aria-hidden="true" />
    </div>
  );
}
