import Link from "next/link";
import { getImageProps } from "next/image";
import { buttonClasses } from "@/components/ui/button";
import { cloudinaryLoader } from "@/lib/cloudinary/delivery";
import type { PublicMedia } from "@/lib/content/queries";
import { Wave } from "../decor";

/**
 * Top of /explore: landscape photo on large screens, portrait photo on phones (Media placements).
 * With no photo (e.g. a flagged image hidden on the live site) it is a plain forest band.
 */
export function ExploreHero({
  strong,
  soft,
  line,
  desktop,
  mobile,
}: {
  strong: string;
  soft: string;
  line: string;
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
    <section aria-labelledby="explore-hero-heading" className={`relative overflow-hidden bg-forest text-cream ${desktopPhoto ? "h-[78svh] min-h-[30rem] md:h-[70svh]" : "pt-32 md:pt-40"}`}>
      {desktopPhoto && mobilePhoto && (
        <picture>
          <source media="(min-width: 768px)" srcSet={props(desktopPhoto).srcSet} />
          <img {...props(mobilePhoto)} alt={mobilePhoto.altText} className="object-cover" />
        </picture>
      )}
      <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-forest/60 to-transparent" aria-hidden="true" />
      <div className="absolute inset-0 bg-linear-to-t from-forest/90 via-forest/35 via-50% to-transparent" aria-hidden="true" />
      {(desktopPhoto?.isPlaceholder || mobilePhoto?.isPlaceholder) && (
        <p className="absolute top-4 left-4 z-10 bg-cream px-2 py-1 font-label text-[0.6875rem] font-medium text-warning">
          DEV PLACEHOLDER: a flagged hero photo (rights unconfirmed). Hidden on the live site.
        </p>
      )}
      <div className={`container-page relative flex flex-col justify-end pb-24 md:pb-32 ${desktopPhoto ? "h-full" : ""}`}>
        <h1 id="explore-hero-heading">
          <span className="text-display block animate-fade-up">{strong}</span>
          <span className="text-heading-soft mt-2 block animate-fade-up [animation-delay:150ms]">{soft}</span>
        </h1>
        <p className="text-body mt-5 max-w-xl animate-fade-up font-medium text-cream [animation-delay:300ms]">{line}</p>
        <div className="mt-7 flex flex-wrap gap-3 animate-fade-up [animation-delay:450ms]">
          <Link href="#at-bagaicha" className={buttonClasses({ variant: "brand-light", size: "lg" })}>
            See what to do
          </Link>
          <Link href="/enquiry?type=STAY" className={buttonClasses({ variant: "brand-outline", size: "lg", className: "text-cream" })}>
            Plan my stay
          </Link>
        </div>
      </div>
      <Wave className="absolute inset-x-0 -bottom-px" />
    </section>
  );
}
