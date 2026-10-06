"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { GalleryCategory, HomepageSlotKey } from "@/generated/prisma/enums";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { ActionError, runAction, type ActionResult } from "@/lib/actions";

/**
 * Where images are placed: a room type's photos, a gallery category or a
 * homepage slot. One set of actions handles all three; order is sortOrder.
 */
const targetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("roomType"), roomTypeId: z.string().min(1).max(64) }),
  z.object({ kind: z.literal("gallery"), category: z.enum(GalleryCategory) }),
  z.object({ kind: z.literal("homepage"), slot: z.enum(HomepageSlotKey) }),
]);
export type PlacementTarget = z.infer<typeof targetSchema>;

const idList = z.array(z.string().min(1).max(64)).min(1).max(200);

type Row = { id: string; mediaId: string; sortOrder: number };

/** Prisma delegate operations for each target kind, so the actions stay generic. */
function placements(tx: Prisma.TransactionClient, target: PlacementTarget) {
  switch (target.kind) {
    case "roomType": {
      const where = { roomTypeId: target.roomTypeId };
      return {
        where,
        list: (): Promise<Row[]> => tx.roomTypeMedia.findMany({ where, orderBy: { sortOrder: "asc" } }),
        create: (mediaId: string, sortOrder: number) =>
          tx.roomTypeMedia.create({ data: { ...where, mediaId, sortOrder } }),
        setOrder: (id: string, sortOrder: number) => tx.roomTypeMedia.update({ where: { id }, data: { sortOrder } }),
        remove: (id: string) => tx.roomTypeMedia.delete({ where: { id } }),
        async assertTarget() {
          const exists = await tx.roomType.findUnique({ where: { id: target.roomTypeId }, select: { id: true } });
          if (!exists) throw new ActionError("That room type no longer exists.");
        },
        paths: ["/admin/rooms", `/admin/rooms/${target.roomTypeId}`],
      };
    }
    case "gallery": {
      const where = { category: target.category };
      return {
        where,
        list: (): Promise<Row[]> => tx.galleryItem.findMany({ where, orderBy: { sortOrder: "asc" } }),
        create: (mediaId: string, sortOrder: number) =>
          tx.galleryItem.create({ data: { ...where, mediaId, sortOrder } }),
        setOrder: (id: string, sortOrder: number) => tx.galleryItem.update({ where: { id }, data: { sortOrder } }),
        remove: (id: string) => tx.galleryItem.delete({ where: { id } }),
        async assertTarget() {},
        paths: ["/admin/media/gallery"],
      };
    }
    case "homepage": {
      const where = { slot: target.slot };
      return {
        where,
        list: (): Promise<Row[]> => tx.homepageSlot.findMany({ where, orderBy: { sortOrder: "asc" } }),
        create: (mediaId: string, sortOrder: number) =>
          tx.homepageSlot.create({ data: { ...where, mediaId, sortOrder } }),
        setOrder: (id: string, sortOrder: number) => tx.homepageSlot.update({ where: { id }, data: { sortOrder } }),
        remove: (id: string) => tx.homepageSlot.delete({ where: { id } }),
        async assertTarget() {},
        paths: ["/admin/media/homepage"],
      };
    }
  }
}

function revalidate(paths: string[]) {
  for (const path of paths) revalidatePath(path);
  revalidatePath("/admin/media"); // usage badges in the library
}

function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new ActionError("That request wasn't valid. Please reload the page and try again.");
  return result.data;
}

export async function addPlacements(rawTarget: PlacementTarget, rawMediaIds: string[]): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("media.manage");
    const target = parse(targetSchema, rawTarget);
    const mediaIds = [...new Set(parse(idList, rawMediaIds))];

    const ops = { paths: [] as string[] };
    const added = await db.$transaction(async (tx) => {
      const p = placements(tx, target);
      ops.paths = p.paths;
      await p.assertTarget();

      const found = await tx.media.count({ where: { id: { in: mediaIds } } });
      if (found !== mediaIds.length) throw new ActionError("Some images no longer exist. Reload and try again.");

      const existing = await p.list();
      const already = new Set(existing.map((row) => row.mediaId));
      const toAdd = mediaIds.filter((id) => !already.has(id));
      let next = existing.length ? Math.max(...existing.map((row) => row.sortOrder)) + 1 : 0;
      for (const mediaId of toAdd) await p.create(mediaId, next++);

      if (toAdd.length) {
        await logActivity(tx, {
          userId: actor.id,
          action: "media.placed",
          entityType: "MediaPlacement",
          details: { target, mediaIds: toAdd },
        });
      }
      return toAdd.length;
    });

    revalidate(ops.paths);
    const skipped = mediaIds.length - added;
    return {
      ok: true,
      message: `${added} image${added === 1 ? "" : "s"} added.${skipped ? ` ${skipped} already there.` : ""}`,
    };
  });
}

export async function removePlacement(rawTarget: PlacementTarget, rawPlacementId: string): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("media.manage");
    const target = parse(targetSchema, rawTarget);
    const placementId = parse(z.string().min(1).max(64), rawPlacementId);

    const ops = { paths: [] as string[] };
    await db.$transaction(async (tx) => {
      const p = placements(tx, target);
      ops.paths = p.paths;
      const row = (await p.list()).find((r) => r.id === placementId);
      if (!row) throw new ActionError("That image was already removed.");
      await p.remove(placementId);
      await logActivity(tx, {
        userId: actor.id,
        action: "media.unplaced",
        entityType: "MediaPlacement",
        entityId: placementId,
        details: { target, mediaId: row.mediaId },
      });
    });

    revalidate(ops.paths);
    return { ok: true, message: "Image removed. It's still in the media library." };
  });
}

/** Saves a new order. The ID list must match the target's current placements exactly. */
export async function reorderPlacements(rawTarget: PlacementTarget, rawOrderedIds: string[]): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("media.manage");
    const target = parse(targetSchema, rawTarget);
    const orderedIds = parse(idList, rawOrderedIds);

    const ops = { paths: [] as string[] };
    await db.$transaction(async (tx) => {
      const p = placements(tx, target);
      ops.paths = p.paths;
      const current = await p.list();
      const same =
        current.length === orderedIds.length &&
        new Set(orderedIds).size === orderedIds.length &&
        orderedIds.every((id) => current.some((row) => row.id === id));
      if (!same) throw new ActionError("The images changed while you were editing. Reload and try again.");

      for (const [index, id] of orderedIds.entries()) await p.setOrder(id, index);
      await logActivity(tx, {
        userId: actor.id,
        action: "media.reordered",
        entityType: "MediaPlacement",
        details: { target, order: orderedIds },
      });
    });

    revalidate(ops.paths);
    return { ok: true, message: "Order saved." };
  });
}
