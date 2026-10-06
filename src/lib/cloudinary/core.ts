/**
 * Cloudinary request signing and endpoints, shared by the app (server only) and
 * scripts/seed-photos.ts. No environment access here; callers pass credentials.
 */
import { createHash } from "node:crypto";

export * from "./rules";

export type SignableParams = Record<string, string | number>;

/**
 * Cloudinary request signature: params sorted by key, joined as k=v&k=v,
 * with the API secret appended, hashed with SHA-1.
 * file, cloud_name, resource_type and api_key are never signed.
 */
export function signParams(params: SignableParams, apiSecret: string): string {
  const toSign = Object.keys(params)
    .filter((key) => !["file", "cloud_name", "resource_type", "api_key", "signature"].includes(key))
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1")
    .update(toSign + apiSecret)
    .digest("hex");
}

export function unixTimestamp(now = Date.now()) {
  return Math.floor(now / 1000);
}

export const cloudinaryApi = {
  upload: (cloudName: string) => `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
  destroy: (cloudName: string) => `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
  resource: (cloudName: string, publicId: string) =>
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload/${publicId
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
};
