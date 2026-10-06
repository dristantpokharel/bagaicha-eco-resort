"use client";

import Image from "next/image";
import { cloudinaryLoader } from "@/lib/cloudinary/delivery";

export type MediaImageData = {
  url: string;
  altText: string;
  width: number;
  height: number;
  blurDataUrl: string | null;
};

/**
 * The only way to render a Media record. The Cloudinary loader adds
 * f_auto,q_auto and a width from `sizes`, so originals are never served.
 */
export function MediaImage({
  media,
  sizes,
  className = "",
  fill = true,
  preload = false,
  alt,
}: {
  media: MediaImageData;
  sizes: string;
  className?: string;
  fill?: boolean;
  preload?: boolean;
  /** Override, e.g. "" for an admin thumbnail whose label is already next to it. */
  alt?: string;
}) {
  const altText = alt ?? media.altText;
  const shared = {
    loader: cloudinaryLoader,
    src: media.url,
    sizes,
    preload,
    className,
    ...(media.blurDataUrl ? { placeholder: "blur" as const, blurDataURL: media.blurDataUrl } : {}),
  };
  return fill ? (
    <Image {...shared} alt={altText} fill />
  ) : (
    <Image {...shared} alt={altText} width={media.width} height={media.height} />
  );
}
