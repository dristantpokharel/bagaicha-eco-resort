"use server";

import { revalidatePath } from "next/cache";
import { revalidatePublicSite } from "@/lib/content/revalidate";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { AuthorizationError, requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { ActionError, parseForm, runAction, type ActionResult } from "@/lib/actions";
import { describeUsage, mediaUsageSelect } from "@/lib/media";
import { isAllowedFormat, isInMediaFolder, MAX_UPLOAD_BYTES, PUBLIC_ID_PATTERN } from "@/lib/cloudinary/rules";
import {
  CloudinaryError,
  createUploadSignature,
  destroyImage,
  fetchBlurDataUrl,
  getResource,
} from "@/lib/cloudinary/server";

const MEDIA_PATH = "/admin/media";

/** Cloudinary failures are expected (outage, missing config): show their message, not a generic one. */
async function withCloudinary<T>(body: () => Promise<T>): Promise<T> {
  try {
    return await body();
  } catch (error) {
    if (error instanceof CloudinaryError) throw new ActionError(`${error.message} Nothing was saved.`);
    throw error;
  }
}

// ─── Upload ──────────────────────────────────────────────────────────────────

export type UploadSignatureResult =
  { ok: true; signature: ReturnType<typeof createUploadSignature> } | { ok: false; error: string };

/** Signs one direct-to-Cloudinary upload. The API secret stays on the server. */
export async function getUploadSignature(): Promise<UploadSignatureResult> {
  try {
    await requirePermission("media.manage");
    return { ok: true, signature: createUploadSignature() };
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof CloudinaryError) {
      return { ok: false, error: error.message };
    }
    console.error("Upload signature failed:", error instanceof Error ? error.name : "unknown error");
    return { ok: false, error: "Couldn't prepare the upload. Please try again." };
  }
}

const saveUploadSchema = z.object({
  publicId: z.string().regex(PUBLIC_ID_PATTERN, { error: "Invalid upload reference." }),
  originalFilename: z.string().trim().max(255).optional(),
});

/**
 * Records an upload after Cloudinary confirms it. The browser only reports the
 * public ID; size, format and dimensions come from Cloudinary's Admin API.
 * Anything outside the rules is deleted from Cloudinary and rejected.
 */
export async function saveUpload(input: z.input<typeof saveUploadSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("media.manage");
    const parsed = saveUploadSchema.safeParse(input);
    if (!parsed.success) throw new ActionError("Invalid upload reference.");
    const { publicId, originalFilename } = parsed.data;

    const existing = await db.media.findUnique({ where: { cloudinaryPublicId: publicId }, select: { id: true } });
    if (existing) return { ok: true, message: "Already in the media library." };

    const resource = await withCloudinary(() => getResource(publicId));
    if (!resource) throw new ActionError("Cloudinary couldn't confirm this upload. Nothing was saved.");

    // Never delete something outside our folder: it may be another asset in the account.
    if (!isInMediaFolder(resource)) {
      throw new ActionError("That upload isn't in the media folder, so it wasn't added. Nothing was deleted.");
    }
    const problem = !isAllowedFormat(resource.format)
      ? `${resource.format.toUpperCase()} isn't an accepted format`
      : resource.bytes > MAX_UPLOAD_BYTES
        ? "it's larger than 10 MB"
        : null;
    if (problem) {
      await withCloudinary(() => destroyImage(resource.public_id));
      throw new ActionError(`The upload was rejected and removed because ${problem}.`);
    }

    const blurDataUrl = await fetchBlurDataUrl(resource.secure_url);

    try {
      await db.$transaction(async (tx) => {
        const media = await tx.media.create({
          data: {
            cloudinaryPublicId: resource.public_id,
            url: resource.secure_url,
            width: resource.width,
            height: resource.height,
            format: resource.format.toLowerCase(),
            bytes: resource.bytes,
            originalFilename: originalFilename || null,
            blurDataUrl,
            altText: "",
            altNeedsReview: true,
          },
        });
        await logActivity(tx, {
          userId: actor.id,
          action: "media.uploaded",
          entityType: "Media",
          entityId: media.id,
          details: { publicId: media.cloudinaryPublicId, bytes: media.bytes },
        });
      });
    } catch (error) {
      // A double submit raced us to the same public ID: the image is already saved.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { ok: true, message: "Already in the media library." };
      }
      throw error;
    }

    revalidatePath(MEDIA_PATH);
    return { ok: true, message: "Uploaded. Add alt text so it can be used on the site." };
  });
}

// ─── Alt text ────────────────────────────────────────────────────────────────

const altTextSchema = z.object({
  mediaId: z.string().trim().min(1).max(64),
  altText: z
    .string()
    .trim()
    .min(3, { error: "Describe the image in a few words." })
    .max(300, { error: "Keep it under 300 characters." }),
});

export async function updateAltText(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("media.manage");
    const input = parseForm(altTextSchema, formData);

    await db.$transaction(async (tx) => {
      const media = await tx.media.findUnique({ where: { id: input.mediaId }, select: { altText: true } });
      if (!media) throw new ActionError("That image no longer exists.");
      await tx.media.update({
        where: { id: input.mediaId },
        data: { altText: input.altText, altNeedsReview: false },
      });
      await logActivity(tx, {
        userId: actor.id,
        action: "media.alt_text_updated",
        entityType: "Media",
        entityId: input.mediaId,
        details: { from: media.altText, to: input.altText },
      });
    });

    revalidatePath(MEDIA_PATH, "layout");
    revalidatePublicSite();
    return { ok: true, message: "Alt text saved." };
  });
}

// ─── Delete ──────────────────────────────────────────────────────────────────

const deleteSchema = z.object({ mediaId: z.string().trim().min(1).max(64) });

/**
 * Deletes an unused image from Cloudinary and the library. The Cloudinary delete
 * runs inside the transaction: if it fails, the database row is kept.
 */
export async function deleteMedia(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("media.manage");
    const input = parseForm(deleteSchema, formData);

    await withCloudinary(() =>
      db.$transaction(
        async (tx) => {
          const media = await tx.media.findUnique({
            where: { id: input.mediaId },
            select: { cloudinaryPublicId: true, ...mediaUsageSelect },
          });
          if (!media) throw new ActionError("That image no longer exists.");
          const usage = describeUsage(media);
          if (usage.length > 0) {
            throw new ActionError(`Remove it from ${usage.join(", ")} before deleting.`);
          }

          await tx.media.delete({ where: { id: input.mediaId } });
          await logActivity(tx, {
            userId: actor.id,
            action: "media.deleted",
            entityType: "Media",
            entityId: input.mediaId,
            details: { publicId: media.cloudinaryPublicId },
          });
          await destroyImage(media.cloudinaryPublicId);
        },
        // Allow for the Cloudinary round trip.
        { timeout: 20_000 },
      ),
    );

    revalidatePath(MEDIA_PATH, "layout");
    revalidatePublicSite();
    return { ok: true, message: "Image deleted from the library and Cloudinary." };
  });
}
