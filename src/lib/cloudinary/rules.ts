/**
 * Upload rules shared by the browser uploader, server actions and the seed
 * script. No Node or environment imports, so client components can use it.
 */

/** Every upload goes into this folder. */
export const MEDIA_FOLDER = "bagaicha";

/** Formats Cloudinary reports for accepted uploads (JPEG is reported as "jpg"). */
export const ALLOWED_FORMATS = ["jpg", "png", "webp", "heic"] as const;

/** MIME types the upload picker accepts (HEIC files sometimes report image/heif). */
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Public IDs we accept back from the browser: inside MEDIA_FOLDER, no odd characters. */
export const PUBLIC_ID_PATTERN = new RegExp(`^${MEDIA_FOLDER}/[A-Za-z0-9_\\-/]{1,200}$`);

/** Fields we read from Cloudinary's upload and Admin API responses. */
export type CloudinaryResource = {
  public_id: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  secure_url: string;
  asset_folder?: string;
};

export function isAllowedFormat(format: string): format is (typeof ALLOWED_FORMATS)[number] {
  return (ALLOWED_FORMATS as readonly string[]).includes(format.toLowerCase());
}

/** True when the resource sits in MEDIA_FOLDER (fixed or dynamic folder mode). */
export function isInMediaFolder(resource: Pick<CloudinaryResource, "public_id" | "asset_folder">) {
  return resource.public_id.startsWith(`${MEDIA_FOLDER}/`) || resource.asset_folder === MEDIA_FOLDER;
}
