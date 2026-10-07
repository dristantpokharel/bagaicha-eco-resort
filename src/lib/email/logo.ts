/**
 * Email logo: the stacked logo as a PNG on Cloudinary (most mail apps drop SVG).
 * Uploaded once by scripts/upload-email-logo.ts under this fixed public ID.
 */
export const EMAIL_LOGO_PUBLIC_ID = "bagaicha/brand/logo-main";

/** Displayed width in CSS px; the image is served at 2x for sharp screens. */
export const EMAIL_LOGO_WIDTH = 140;

/** Null when Cloudinary isn't configured, so emails fall back to the text name. */
export function emailLogoUrl(cloudName = process.env.CLOUDINARY_CLOUD_NAME): string | null {
  if (!cloudName) return null;
  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/upload/f_png,w_${EMAIL_LOGO_WIDTH * 2}/${EMAIL_LOGO_PUBLIC_ID}.png`;
}
