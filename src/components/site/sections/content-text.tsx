import { Placeholder } from "../placeholder";

/** A paragraph of content; dev placeholder text gets the visible badge. */
export function ContentText({ text, flagged = false, className = "text-body" }: { text: string | null; flagged?: boolean; className?: string }) {
  if (!text) return null;
  return flagged ? <Placeholder>{text}</Placeholder> : <p className={className}>{text}</p>;
}

/** Text with blank-line paragraph breaks (policies, long descriptions). */
export function Paragraphs({ text, flagged = false }: { text: string; flagged?: boolean }) {
  if (flagged) return <Placeholder>{text}</Placeholder>;
  return (
    <div className="space-y-4">
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i} className="text-body whitespace-pre-line">
          {p}
        </p>
      ))}
    </div>
  );
}
