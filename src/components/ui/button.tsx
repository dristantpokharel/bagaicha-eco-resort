import type { ButtonHTMLAttributes } from "react";

// primary/secondary/danger/ghost: admin. brand/brand-light/brand-outline: public site
// (square, Montserrat label type, per docs/design-tokens.md).
type Variant = "primary" | "secondary" | "danger" | "ghost" | "brand" | "brand-light" | "brand-outline";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors ease-smooth " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "focus-visible:outline-forest rounded-md bg-forest text-cream hover:bg-forest-dark",
  secondary: "focus-visible:outline-forest rounded-md border border-forest/30 bg-white text-forest hover:bg-cream",
  danger: "focus-visible:outline-forest rounded-md border border-error/40 bg-white text-error hover:bg-error/5",
  ghost: "focus-visible:outline-forest rounded-md text-forest hover:bg-forest/5",
  brand: "focus-visible:outline-forest font-label uppercase tracking-[0.18em] bg-forest text-cream hover:bg-olive",
  "brand-light":
    "font-label uppercase tracking-[0.18em] bg-cream text-forest hover:bg-sage focus-visible:outline-cream",
  "brand-outline":
    "font-label uppercase tracking-[0.18em] border border-current bg-transparent hover:bg-cream/10 focus-visible:outline-current",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "min-h-12 px-7 text-xs",
};

/** Shared button styling, also usable on links. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className = "",
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}
