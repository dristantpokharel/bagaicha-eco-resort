/**
 * Cloudinary delivery URLs (safe for client components; no secrets).
 * Free tier rule: every image is served with f_auto,q_auto and a bounded
 * width. The stored original URL is never rendered directly.
 */

const UPLOAD_SEGMENT = "/image/upload/";

/** Largest width we ever request; c_limit also prevents upscaling. */
export const MAX_DELIVERY_WIDTH = 2400;

export function isCloudinaryUrl(url: string) {
  try {
    const { protocol, hostname, pathname } = new URL(url);
    return protocol === "https:" && hostname === "res.cloudinary.com" && pathname.includes(UPLOAD_SEGMENT);
  } catch {
    return false;
  }
}

/**
 * Insert a transformation into a stored secure_url:
 * .../image/upload/v123/bagaicha/x.jpg → .../image/upload/f_auto,q_auto,c_limit,w_800/v123/bagaicha/x.jpg
 */
export function deliveryUrl(url: string, width: number): string {
  if (!isCloudinaryUrl(url)) throw new Error("Not a Cloudinary upload URL");
  const w = Math.max(16, Math.min(MAX_DELIVERY_WIDTH, Math.round(width)));
  const index = url.indexOf(UPLOAD_SEGMENT) + UPLOAD_SEGMENT.length;
  return `${url.slice(0, index)}f_auto,q_auto,c_limit,w_${w}/${url.slice(index)}`;
}

/** next/image loader: Cloudinary resizes, so Next never fetches the original. */
export function cloudinaryLoader({ src, width }: { src: string; width: number }) {
  return deliveryUrl(src, width);
}
