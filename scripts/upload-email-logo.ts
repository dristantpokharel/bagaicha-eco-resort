/**
 * One-off: upload docs/logo/Logo-main.png to Cloudinary under a fixed public ID so
 * emails can link to it (most mail apps don't render SVG). Safe to re-run; it overwrites.
 *
 *   npx tsx scripts/upload-email-logo.ts
 *
 * Never prints secret values.
 */
import { readFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { cloudinaryApi, signParams, unixTimestamp } from "../src/lib/cloudinary/core";
import { EMAIL_LOGO_PUBLIC_ID } from "../src/lib/email/logo";

async function main() {
  loadEnv({ path: ".env.local", quiet: true });
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloud || !key || !secret) throw new Error("Cloudinary credentials missing in .env.local");

  const params = { public_id: EMAIL_LOGO_PUBLIC_ID, overwrite: "true", invalidate: "true", timestamp: unixTimestamp() };
  const body = new FormData();
  body.append("file", new Blob([readFileSync("docs/logo/Logo-main.png")], { type: "image/png" }), "Logo-main.png");
  for (const [k, v] of Object.entries(params)) body.append(k, String(v));
  body.append("api_key", key);
  body.append("signature", signParams(params, secret));

  const response = await fetch(cloudinaryApi.upload(cloud), { method: "POST", body });
  const data = (await response.json()) as { public_id?: string; bytes?: number; secure_url?: string; error?: { message: string } };
  if (!response.ok) throw new Error(`Upload failed: ${data.error?.message ?? response.status}`);
  console.log(`Uploaded ${data.public_id} (${data.bytes} bytes)`);
  console.log(`URL: ${data.secure_url?.replace(cloud, "<cloud>")}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
