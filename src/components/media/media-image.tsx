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
}: {
  media: MediaImageData;
  sizes: string;
  className?: string;
  fill?: boolean;
  preload?: boolean;
}) {
  const shared = {
    loader: cloudinaryLoader,
    src: media.url,
    alt: media.altText,
    sizes,
    preload,
    className,
    ...(media.blurDataUrl ? { placeholder: "blur" as const, blurDataURL: media.blurDataUrl } : {}),
  };
  return fill ? <Image {...shared} fill /> : <Image {...shared} width={media.width} height={media.height} />;
}
