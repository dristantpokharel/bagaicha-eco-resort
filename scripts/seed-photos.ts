/**
 * One-off: upload docs/photos to Cloudinary and add them to the media library.
 *
 *   npm run media:seed-photos -- --dry-run   # no network or database calls
 *   npm run media:seed-photos                # uploads; run manually, never on build/deploy
 *
 * - Idempotent: each photo gets a fixed public ID (bagaicha/seed/<name>). Photos
 *   already in the database are skipped; uploads use overwrite=false, so a photo
 *   left on Cloudinary by an interrupted run is reused instead of duplicated.
 * - HEIC is converted to JPEG with macOS `sips` (sharp can't decode HEIC), then
 *   sharp applies EXIF rotation, resizes to fit 2560 px, and strips metadata
 *   (including any GPS location).
 * - Alt text is a draft made from the filename and flagged for review.
 * - Never prints secret values.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { config as loadEnv } from "dotenv";
import sharp from "sharp";
import { z } from "zod";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { logActivity } from "../src/lib/activity-log";
import {
  cloudinaryApi,
  fetchBlurDataUrl,
  MAX_UPLOAD_BYTES,
  MEDIA_FOLDER,
  signParams,
  unixTimestamp,
  type CloudinaryResource,
} from "../src/lib/cloudinary/core";

const PHOTOS_DIR = "docs/photos";
const MAX_EDGE = 2560;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);

/** Files deliberately left out. Edit this list to change what gets seeded. */
const SKIP: Record<string, string> = {
  "night-farmhouse.jpg": "skipped at the owner's request",
  "brochure-front-page-vertical.png": "brochure reference, not a website photo",
  "explore-bardiya-caravan.jpeg": "shows another organisation's vehicle; left out at the owner's request",
};

/** Illustrations stay PNG (sharp edges, text); everything else becomes JPEG. */
const KEEP_PNG = new Set(["Bagaicha-MAP.png", "location-QR-code.png"]);

/** Fixed alt text instead of the filename draft. The mockup must never pass as a real event photo. */
const ALT_OVERRIDES: Record<string, string> = {
  "wedding-mock.png": "Placeholder – wedding mockup",
  // Drafts written by looking at each image. They describe only what is visible and are flagged for review.
  "explore-Bardiya-NP-gate.jpg": "The green and yellow entrance gate of Bardiya National Park, with a welcome sign and painted wildlife murals",
  "explore-bardiya-elephants.jpg": "Three elephants carrying riders with umbrellas, walking through tall grass in the forest",
  "explore-bardiya-crocodile.jpeg": "A crocodile resting on sand beside a pool in a concrete enclosure under trees",
  "explore-bardiya-rhino.jpeg": "A one-horned rhino eating leaves beside a wooden post and a low fence",
  "explore-bardiya-red-sunset-vertical.jpeg": "A red sun setting behind thin clouds over a dark line of trees",
  "explore-bardiya-tiger.jpg": "A tiger walking along the edge of a river, reflected in the water",
  "explore-birdwatching.jpg": "Painted storks and a woolly-necked stork standing at the edge of a shallow wetland",
  "explore-hero-vertical.jpeg": "Tall trees at sunset over a grassy field, with a motorbike parked in the foreground",
  "explore-jeep-safari.jpg": "A safari jeep with tourists photographing a leopard crossing a grass track",
  "explore-jungle-walk.jpg": "A person in a blue rain jacket walking along a forest path between tall trees and green undergrowth",
  "explore-karnali.jpeg": "A bridge over a wide stony riverbed, with forested hills behind",
  "explore-krishnasaar.jpg": "A herd of blackbuck, males and females, standing in tall golden grass",
  "explore-mustard-plan-vertical.jpeg": "A field of yellow mustard flowers with a row of young trees behind, under a blue sky",
  "explore-pickleball.png": "A pickleball court with a net, a bench with two paddles and yellow balls, and white cottages among palm trees behind",
  "explore-tharu-village.jpg": "Mud-walled village houses with tiled roofs and a thatched shelter in a green field, with hills behind",
};

/**
 * Images that must not appear on the live site yet. New library rows are created with the
 * placeholder flag set (badge in development, hidden in production) until someone ticks
 * "Rights confirmed / final" in Media.
 */
const RIGHTS = "Rights unconfirmed";
const PLACEHOLDER_NOTES: Record<string, string> = {
  "explore-tharu-village.jpg": "Watermarked Adobe Stock preview, not licensed",
  "explore-jeep-safari.jpg": "Looks like a stock or edited image, probably not Bardiya",
  "explore-pickleball.png": "Looks AI-generated: confirm it shows Bagaicha's court",
  "explore-bardiya-tiger.jpg": RIGHTS,
  "explore-bardiya-elephants.jpg": RIGHTS,
  "explore-Bardiya-NP-gate.jpg": RIGHTS,
  "explore-krishnasaar.jpg": RIGHTS,
  "explore-jungle-walk.jpg": RIGHTS,
  "explore-birdwatching.jpg": RIGHTS,
};

const dryRun = process.argv.includes("--dry-run");

type Prepared = {
  file: string;
  publicId: string;
  altDraft: string;
  placeholderNote: string | null;
  buffer: Buffer;
  format: "jpeg" | "png";
  width: number;
  height: number;
  convertedFromHeic: boolean;
};

function slug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "family-room-1.png" → "Family room 1"; short all-caps words (QR, MAP) are kept. */
export function altFromFilename(file: string) {
  const words = basename(file, extname(file))
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => (word.length <= 4 && word === word.toUpperCase() && /[A-Z]/.test(word) ? word : word.toLowerCase()));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** HEIC/HEIF files are ISO-BMFF with an "ftyp" brand of heic/heix/mif1/msf1/hevc, whatever the extension says. */
function isHeic(buffer: Buffer) {
  if (buffer.length < 12 || buffer.toString("ascii", 4, 8) !== "ftyp") return false;
  return ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(buffer.toString("ascii", 8, 12));
}

function heicToJpeg(path: string, workDir: string): Buffer {
  if (process.platform !== "darwin") {
    throw new Error(`${basename(path)} is HEIC; converting it needs macOS (sips). Convert it to JPEG first.`);
  }
  const out = join(workDir, `${slug(basename(path))}.jpg`);
  execFileSync("sips", ["-s", "format", "jpeg", path, "--out", out], { stdio: "ignore" });
  return readFileSync(out);
}

async function prepare(file: string, workDir: string): Promise<Prepared> {
  const path = join(PHOTOS_DIR, file);
  const original = readFileSync(path);
  const convertedFromHeic = isHeic(original);
  const input = convertedFromHeic ? heicToJpeg(path, workDir) : original;
  const format = KEEP_PNG.has(file) ? "png" : "jpeg";

  // rotate() with no angle applies the EXIF orientation; sharp drops metadata by default.
  const pipeline = sharp(input, { limitInputPixels: false })
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true });

  let quality = 85;
  let result = await (
    format === "png" ? pipeline.clone().png({ compressionLevel: 9 }) : pipeline.clone().jpeg({ quality, mozjpeg: true })
  ).toBuffer({ resolveWithObject: true });
  while (format === "jpeg" && result.data.byteLength > MAX_UPLOAD_BYTES && quality > 50) {
    quality -= 10;
    result = await pipeline.clone().jpeg({ quality, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  }
  if (result.data.byteLength > MAX_UPLOAD_BYTES) throw new Error(`${file} is still over 10 MB after resizing.`);

  return {
    file,
    publicId: `${MEDIA_FOLDER}/seed/${slug(basename(file, extname(file)))}`,
    altDraft: ALT_OVERRIDES[file] ?? altFromFilename(file),
    placeholderNote: PLACEHOLDER_NOTES[file] ?? null,
    buffer: result.data,
    format,
    width: result.info.width,
    height: result.info.height,
    convertedFromHeic,
  };
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
});

async function upload(photo: Prepared, env: z.infer<typeof envSchema>): Promise<CloudinaryResource> {
  const params = { overwrite: "false", public_id: photo.publicId, timestamp: unixTimestamp() };
  const body = new FormData();
  body.append(
    "file",
    new Blob([new Uint8Array(photo.buffer)], { type: `image/${photo.format}` }),
    `${slug(photo.file)}.${photo.format === "png" ? "png" : "jpg"}`,
  );
  for (const [key, value] of Object.entries(params)) body.append(key, String(value));
  body.append("api_key", env.CLOUDINARY_API_KEY);
  body.append("signature", signParams(params, env.CLOUDINARY_API_SECRET));

  const response = await fetch(cloudinaryApi.upload(env.CLOUDINARY_CLOUD_NAME), { method: "POST", body });
  const data = (await response.json().catch(() => ({}))) as Partial<CloudinaryResource> & {
    error?: { message?: string };
  };
  if (!response.ok || !data.public_id || !data.secure_url) {
    throw new Error(`Cloudinary upload failed for ${photo.file}: ${data.error?.message ?? `HTTP ${response.status}`}`);
  }
  return data as CloudinaryResource;
}

async function main() {
  const files = readdirSync(PHOTOS_DIR)
    .filter((file) => IMAGE_EXTENSIONS.has(extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  const skipped = files.filter((file) => SKIP[file]);
  const toSeed = files.filter((file) => !SKIP[file]);

  console.log(
    `${dryRun ? "DRY RUN (no network or database calls). " : ""}${toSeed.length} photo(s) to seed from ${PHOTOS_DIR}/`,
  );
  for (const file of skipped) console.log(`  skip  ${file} (${SKIP[file]})`);

  const workDir = mkdtempSync(join(tmpdir(), "bagaicha-seed-"));
  try {
    const prepared: Prepared[] = [];
    for (const file of toSeed) prepared.push(await prepare(file, workDir));

    if (dryRun) {
      for (const p of prepared) {
        console.log(
          `  would upload  ${p.file}${p.convertedFromHeic ? " (HEIC → JPEG)" : ""}\n` +
            `      → ${p.publicId}  ${p.format.toUpperCase()} ${p.width}×${p.height}, ${(p.buffer.byteLength / 1024 / 1024).toFixed(2)} MB\n` +
            `      alt draft: "${p.altDraft}" (flagged for review)` +
            (p.placeholderNote ? `\n      FLAGGED placeholder: ${p.placeholderNote}` : ""),
        );
      }
      console.log("Dry run finished. Photos already in the database would be skipped in a real run.");
      return;
    }

    loadEnv({ path: ".env.local", quiet: true });
    const env = envSchema.safeParse(process.env);
    if (!env.success) {
      const missing = env.error.issues.map((issue) => String(issue.path[0])).join(", ");
      throw new Error(`Missing environment variables: ${missing}`);
    }

    const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: env.data.DATABASE_URL }) });
    let added = 0;
    try {
      for (const photo of prepared) {
        const existing = await db.media.findUnique({
          where: { cloudinaryPublicId: photo.publicId },
          select: { id: true },
        });
        if (existing) {
          console.log(`  exists  ${photo.file} (already in the library)`);
          continue;
        }

        const resource = await upload(photo, env.data);
        const blurDataUrl = await fetchBlurDataUrl(resource.secure_url);
        await db.$transaction(async (tx) => {
          const media = await tx.media.create({
            data: {
              cloudinaryPublicId: resource.public_id,
              url: resource.secure_url,
              width: resource.width,
              height: resource.height,
              format: resource.format.toLowerCase(),
              bytes: resource.bytes,
              originalFilename: photo.file,
              blurDataUrl,
              altText: photo.altDraft,
              altNeedsReview: true,
              isPlaceholder: photo.placeholderNote !== null,
              placeholderNote: photo.placeholderNote,
            },
          });
          await logActivity(tx, {
            userId: null,
            action: "media.seeded",
            entityType: "Media",
            entityId: media.id,
            details: { file: photo.file, publicId: media.cloudinaryPublicId },
          });
        });
        added++;
        console.log(`  added   ${photo.file} → ${resource.public_id}`);
      }
    } finally {
      await db.$disconnect();
    }
    console.log(
      `Done: ${added} added, ${prepared.length - added} already present. Review the draft alt text in Media → Library.`,
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  // Prisma messages can echo query arguments: print the code only.
  if (error instanceof Prisma.PrismaClientKnownRequestError) console.error(`Seed failed: database error ${error.code}`);
  else console.error(error instanceof Error ? error.message : "Seed failed.");
  process.exit(1);
});
