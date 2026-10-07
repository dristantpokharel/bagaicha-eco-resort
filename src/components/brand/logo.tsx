import Image from "next/image";

/**
 * Brand artwork from public/brand (outlined SVGs, never re-typeset; docs/design-tokens.md).
 * `unoptimized`: next/image passes SVG through untouched anyway, and these files are small.
 * Width and height are the SVG viewBox ratios, so layout never shifts; size with `className`.
 */
const ART = {
  emblem: { src: "/brand/logo-only.svg", width: 335, height: 335 },
  wordmark: { src: "/brand/logo-text.svg", width: 192, height: 77 },
  "wordmark-white": { src: "/brand/text-only-white.svg", width: 295, height: 118 },
} as const;

export type LogoArt = keyof typeof ART;

export function Logo({ art, className = "", alt = "" }: { art: LogoArt; className?: string; alt?: string }) {
  const { src, width, height } = ART[art];
  return <Image src={src} width={width} height={height} alt={alt} unoptimized className={className} />;
}
