import Image from "next/image";
import { MediaImage, type MediaImageData } from "@/components/media/media-image";
import { Placeholder } from "./placeholder";

const frame = "relative overflow-hidden bg-sage";

/**
 * Brochure photo treatment: square corners, no border/shadow/filter, cropped
 * to a fixed aspect so layouts don't shift. `className` sets size/aspect.
 * For files in /public (logo only); everything else is a Cloudinary `MediaPhoto`.
 */
export function Photo({
  src,
  alt,
  sizes,
  className = "",
  imgClassName = "",
  preload = false,
  children,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  imgClassName?: string;
  preload?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`${frame} ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} preload={preload} className={`object-cover ${imgClassName}`} />
      {children}
    </div>
  );
}

/** A Media record in the same frame. Mockups carry a visible dev badge. */
export function MediaPhoto({
  media,
  sizes,
  className = "",
  imgClassName = "",
  preload = false,
  compact = false,
  children,
}: {
  media: MediaImageData & { isPlaceholder?: boolean; placeholderNote?: string | null };
  sizes: string;
  className?: string;
  imgClassName?: string;
  preload?: boolean;
  /** Small thumbnails: a short badge instead of the full note. */
  compact?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`${frame} ${className}`}>
      <MediaImage media={media} sizes={sizes} preload={preload} className={`object-cover ${imgClassName}`} />
      {media.isPlaceholder && compact && (
        <span className="absolute top-1 left-1 bg-cream px-1.5 py-0.5 font-label text-[0.625rem] font-semibold text-warning uppercase">
          Placeholder
        </span>
      )}
      {media.isPlaceholder && !compact && (
        <Placeholder className="absolute top-3 right-3 left-3 sm:right-auto">
          {media.placeholderNote ?? "Placeholder / rights unconfirmed"}. Hidden on the live site.
        </Placeholder>
      )}
      {children}
    </div>
  );
}
