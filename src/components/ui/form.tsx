import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

const control =
  "block w-full rounded-md border border-charcoal/25 bg-white px-3 text-sm text-charcoal " +
  "placeholder:text-charcoal-light focus-visible:border-forest focus-visible:outline-2 " +
  "focus-visible:outline-offset-0 focus-visible:outline-forest/40 " +
  "aria-[invalid=true]:border-error";

export function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-charcoal">
      {children}
    </label>
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${control} h-10 ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${control} h-10 ${className}`} {...props} />;
}

/** Label + control + optional hint/error, wired up for screen readers. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-charcoal-light">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** Form-level result message. Errors are announced assertively. */
export function FormMessage({ type, children }: { type: "error" | "success"; children: ReactNode }) {
  if (!children) return null;
  const styles =
    type === "error" ? "border-error/30 bg-error/5 text-error" : "border-success/30 bg-success/5 text-success";
  return (
    <p role={type === "error" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  );
}
