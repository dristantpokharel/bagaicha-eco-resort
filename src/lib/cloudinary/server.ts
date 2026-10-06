import "server-only";
import { z } from "zod";
import {
  ALLOWED_FORMATS,
  cloudinaryApi,
  MEDIA_FOLDER,
  signParams,
  unixTimestamp,
  type CloudinaryResource,
} from "./core";

export { fetchBlurDataUrl } from "./core";

/**
 * Server-side Cloudinary access. The API secret never leaves this module:
 * the browser only ever receives a signature for one upload.
 */

const envSchema = z.object({
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
});

export class CloudinaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudinaryError";
  }
}

function config() {
  const env = envSchema.safeParse(process.env);
  if (!env.success) {
    // Name the missing variables, never their values.
    const missing = env.error.issues.map((issue) => String(issue.path[0])).join(", ");
    throw new CloudinaryError(`Cloudinary is not configured (${missing}).`);
  }
  return {
    cloudName: env.data.CLOUDINARY_CLOUD_NAME,
    apiKey: env.data.CLOUDINARY_API_KEY,
    apiSecret: env.data.CLOUDINARY_API_SECRET,
  };
}

/** Everything the browser needs for one signed upload into MEDIA_FOLDER. */
export function createUploadSignature() {
  const { cloudName, apiKey, apiSecret } = config();
  const params = {
    allowed_formats: ALLOWED_FORMATS.join(","),
    folder: MEDIA_FOLDER,
    timestamp: unixTimestamp(),
  };
  return {
    uploadUrl: cloudinaryApi.upload(cloudName),
    apiKey,
    ...params,
    signature: signParams(params, apiSecret),
  };
}

function basicAuth() {
  const { apiKey, apiSecret } = config();
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
}

/** Confirms an upload exists and returns Cloudinary's own record of it (null if not found). */
export async function getResource(publicId: string): Promise<CloudinaryResource | null> {
  const { cloudName } = config();
  const response = await fetch(cloudinaryApi.resource(cloudName, publicId), {
    headers: { Authorization: basicAuth() },
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new CloudinaryError(`Cloudinary lookup failed (HTTP ${response.status}).`);
  return (await response.json()) as CloudinaryResource;
}

/** Deletes an image. "not found" counts as success, so retries are safe. */
export async function destroyImage(publicId: string): Promise<void> {
  const { cloudName, apiKey, apiSecret } = config();
  const params = { invalidate: "true", public_id: publicId, timestamp: unixTimestamp() };
  const body = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    api_key: apiKey,
    signature: signParams(params, apiSecret),
  });
  const response = await fetch(cloudinaryApi.destroy(cloudName), { method: "POST", body, cache: "no-store" });
  const result = response.ok ? ((await response.json()) as { result?: string }) : null;
  if (!result || (result.result !== "ok" && result.result !== "not found")) {
    throw new CloudinaryError(`Cloudinary delete failed (HTTP ${response.status}).`);
  }
}
