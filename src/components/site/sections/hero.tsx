import Link from "next/link";
import { getImageProps } from "next/image";
import { buttonClasses } from "@/components/ui/button";
import { cloudinaryLoader } from "@/lib/cloudinary/delivery";
import type { PublicMedia } from "@/lib/content/queries";
import { BOOKING_HREF } from "@/config/site-copy";
import { Wave } from "../decor";

/** Full-screen hero. Desktop and phone photos come from the Media placements; the first is preloaded. */
export function Hero({
  name,
  tagline,
  desktop,
  mobile,
}: {
  name: string;
  tagline: string | null;
  desktop?: PublicMedia;
  mobile?: PublicMedia;
}) {
  const desktopPhoto = desktop ?? mobile;
  const mobilePhoto = mobile ?? desktop;
  const props = (m: PublicMedia) =>
    getImageProps({
      loader: cloudinaryLoader,
      src: m.url,
      alt: m.altText,
      fill: true,
      sizes: "100vw",
      fetchPriority: "high",
      loading: "eager",
    }).props;

  return (
    <section aria-labelledby="hero-heading" className="relative h-svh min-h-[38rem] overflow-hidden bg-forest text-cream">
      {desktopPhoto && mobilePhoto && (
        <picture>
          <source media="(min-width: 768px)" srcSet={props(desktopPhoto).srcSet} />
          <img {...props(mobilePhoto)} alt={mobilePhoto.altText} className="object-cover" />
        </picture>
      )}
      {/* Legibility scrims: header at the top, title at the bottom */}
      <div className="absolute inset-x-0 top-0 h-40 bg-linear-to-b from-forest/70 to-transparent" aria-hidden="true" />
      <div className="absolute inset-0 bg-linear-to-t from-forest/90 via-forest/35 via-45% to-transparent" aria-hidden="true" />

      <div className="container-page relative flex h-full flex-col justify-end pb-28 md:pb-40">
        <p className="text-label animate-fade-up" aria-label="Stay, Dine, Celebrate, Explore">
          Stay <span aria-hidden="true">|</span> Dine <span aria-hidden="true">|</span> Celebrate{" "}
          <span aria-hidden="true">|</span> Explore
        </p>
        <h1 id="hero-heading" className="text-display mt-5 max-w-3xl animate-fade-up [animation-delay:150ms]">
          {name}
        </h1>
        {tagline && <p className="text-heading-soft mt-3 animate-fade-up [animation-delay:300ms]">{tagline}</p>}
        <div className="mt-9 flex flex-wrap gap-3 animate-fade-up [animation-delay:450ms]">
          <Link href="#pillars" className={buttonClasses({ variant: "brand-light", size: "lg" })}>
            Explore Bagaicha
          </Link>
          <Link href={BOOKING_HREF} className={buttonClasses({ variant: "brand-outline", size: "lg", className: "text-cream" })}>
            Book Your Stay
          </Link>
        </div>
      </div>
      <Wave className="absolute inset-x-0 -bottom-px" />
    </section>
  );
}
