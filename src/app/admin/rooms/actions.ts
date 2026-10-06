"use server";

import { revalidatePath } from "next/cache";
import { remainingPlaceholders } from "@/lib/content/placeholder";
import { revalidatePublicSite } from "@/lib/content/revalidate";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { ensureRoomLocation } from "@/lib/inventory/locations";
import { ActionError, parseForm, runAction, type ActionResult } from "@/lib/actions";
import { todayInResort } from "@/lib/dates";
import { lockRoom } from "@/lib/booking/availability";
import { createRoomSchema, renameRoomSchema, roomTypeSchema, setActiveSchema, updateRoomTypeSchema } from "./schemas";

const ROOMS_PATH = "/admin/rooms";

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function revalidateRooms(roomTypeId?: string) {
  revalidatePath(ROOMS_PATH);
  if (roomTypeId) revalidatePath(`${ROOMS_PATH}/${roomTypeId}`);
  revalidatePublicSite();
}

// ─── Room types ──────────────────────────────────────────────────────────────

export async function createRoomType(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  let createdId: string | null = null;
  const result = await runAction(async () => {
    const actor = await requirePermission("rooms.manage");
    const input = parseForm(roomTypeSchema, formData);

    try {
      createdId = await db.$transaction(async (tx) => {
        const roomType = await tx.roomType.create({ data: input });
        await logActivity(tx, {
          userId: actor.id,
          action: "roomType.created",
          entityType: "RoomType",
          entityId: roomType.id,
          details: { name: roomType.name, basePriceNpr: roomType.basePriceNpr },
        });
        return roomType.id;
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ActionError("That URL slug is already used.", { slug: "Already in use." });
      throw error;
    }

    revalidateRooms();
    return { ok: true, message: `${input.name} created.` };
  });

  // redirect() throws, so it must run outside runAction's try/catch.
  if (result.ok && createdId) redirect(`${ROOMS_PATH}/${createdId}?created=1`);
  return result;
}

export async function updateRoomType(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("rooms.manage");
    const { roomTypeId, ...input } = parseForm(updateRoomTypeSchema, formData);

    try {
      await db.$transaction(async (tx) => {
        const before = await tx.roomType.findUnique({ where: { id: roomTypeId } });
        if (!before) throw new ActionError("That room type no longer exists.");
        const placeholderFields = remainingPlaceholders(before, input, before.placeholderFields);
        await tx.roomType.update({ where: { id: roomTypeId }, data: { ...input, placeholderFields } });

        const changed = (Object.keys(input) as (keyof typeof input)[]).filter(
          (key) => JSON.stringify(before[key]) !== JSON.stringify(input[key]),
        );
        if (changed.length) {
          await logActivity(tx, {
            userId: actor.id,
            action: "roomType.updated",
            entityType: "RoomType",
            entityId: roomTypeId,
            details: Object.fromEntries(changed.map((key) => [key, { from: before[key], to: input[key] }])),
          });
        }
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ActionError("That URL slug is already used.", { slug: "Already in use." });
      throw error;
    }

    revalidateRooms(roomTypeId);
    return { ok: true, message: "Room type saved." };
  });
}

export async function setRoomTypeActive(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("rooms.manage");
    const { id, isActive } = parseForm(setActiveSchema, formData);

    await db.$transaction(async (tx) => {
      const roomType = await tx.roomType.findUnique({ where: { id }, select: { isActive: true } });
      if (!roomType) throw new ActionError("That room type no longer exists.");
      if (roomType.isActive === isActive) return;
      await tx.roomType.update({ where: { id }, data: { isActive } });
      await logActivity(tx, {
        userId: actor.id,
        action: isActive ? "roomType.activated" : "roomType.archived",
        entityType: "RoomType",
        entityId: id,
      });
    });

    revalidateRooms(id);
    return {
      ok: true,
      message: isActive ? "Room type is active again." : "Room type archived. Guests can no longer request it.",
    };
  });
}

// ─── Rooms ───────────────────────────────────────────────────────────────────

export async function createRoom(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("rooms.manage");
    const input = parseForm(createRoomSchema, formData);

    try {
      await db.$transaction(async (tx) => {
        const roomType = await tx.roomType.findUnique({ where: { id: input.roomTypeId }, select: { id: true } });
        if (!roomType) throw new ActionError("That room type no longer exists.");
        const room = await tx.room.create({ data: input });
        await ensureRoomLocation(tx, room.id);
        await logActivity(tx, {
          userId: actor.id,
          action: "room.created",
          entityType: "Room",
          entityId: room.id,
          details: { name: room.name, roomTypeId: room.roomTypeId },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ActionError("This room type already has a room with that name.", { name: "Already in use." });
      }
      throw error;
    }

    revalidateRooms(input.roomTypeId);
    return { ok: true, message: `Room ${input.name} added.` };
  });
}

export async function renameRoom(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("rooms.manage");
    const input = parseForm(renameRoomSchema, formData);

    let roomTypeId = "";
    try {
      await db.$transaction(async (tx) => {
        const room = await tx.room.findUnique({ where: { id: input.roomId } });
        if (!room) throw new ActionError("That room no longer exists.");
        roomTypeId = room.roomTypeId;
        if (room.name === input.name) return;
        await tx.room.update({ where: { id: room.id }, data: { name: input.name } });
        await logActivity(tx, {
          userId: actor.id,
          action: "room.renamed",
          entityType: "Room",
          entityId: room.id,
          details: { from: room.name, to: input.name },
        });
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ActionError("This room type already has a room with that name.", { name: "Already in use." });
      }
      throw error;
    }

    revalidateRooms(roomTypeId);
    return { ok: true, message: "Room renamed." };
  });
}

export async function setRoomActive(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("rooms.manage");
    const { id, isActive } = parseForm(setActiveSchema, formData);

    let roomTypeId = "";
    await db.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { id }, select: { isActive: true, roomTypeId: true } });
      if (!room) throw new ActionError("That room no longer exists.");
      roomTypeId = room.roomTypeId;
      if (room.isActive === isActive) return;

      if (!isActive) {
        // Same lock as confirming a booking, so an archive and a confirm can't both pass.
        await lockRoom(tx, id);
        // A guest is staying or confirmed to stay: archiving would hide a live booking.
        const upcoming = await tx.booking.count({
          where: { roomId: id, status: { in: ["CONFIRMED", "CHECKED_IN"] }, checkOut: { gt: todayInResort() } },
        });
        if (upcoming > 0) {
          throw new ActionError(
            `This room has ${upcoming} current or upcoming confirmed booking${upcoming === 1 ? "" : "s"}. Move ${
              upcoming === 1 ? "it" : "them"
            } to another room first.`,
          );
        }
      }

      await tx.room.update({ where: { id }, data: { isActive } });
      await logActivity(tx, {
        userId: actor.id,
        action: isActive ? "room.activated" : "room.archived",
        entityType: "Room",
        entityId: id,
      });
    });

    revalidateRooms(roomTypeId);
    return { ok: true, message: isActive ? "Room is active again." : "Room archived." };
  });
}
