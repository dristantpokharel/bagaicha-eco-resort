"use server";

import { revalidatePath } from "next/cache";
import { revalidateAvailability } from "@/lib/booking/availability-data";
import { z } from "zod";
import { BOOKING_TX_OPTIONS, db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { ActionError, parseForm, runAction, type ActionResult } from "@/lib/actions";
import { OCCUPYING_STATUSES, lockRoom } from "@/lib/booking/availability";
import { parseDateOnly, toDateOnlyString } from "@/lib/booking/dates";

const id = z.string().trim().min(1).max(64);

const createBlockSchema = z.object({
  roomId: id,
  startDate: z.string().trim().max(10),
  endDate: z.string().trim().max(10),
  reason: z.string().trim().min(3, { error: "Give a short reason." }).max(200),
});

function revalidateAdmin() {
  revalidateAvailability();
  revalidatePath("/admin", "layout");
}

/** Blocks a room for [startDate, endDate): maintenance, owner use… Admin and Superuser only. */
export async function createRoomBlock(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("rooms.blockDates");
    const input = parseForm(createBlockSchema, formData);

    const startDate = parseDateOnly(input.startDate);
    const endDate = parseDateOnly(input.endDate);
    if (!startDate) throw new ActionError("Choose the first blocked night.", { startDate: "Choose a date." });
    if (!endDate) throw new ActionError("Choose the day the room is available again.", { endDate: "Choose a date." });
    if (endDate <= startDate) {
      throw new ActionError("The room must be available again after the first blocked night.", {
        endDate: "Must be after the first blocked night.",
      });
    }

    await db.$transaction(async (tx) => {
      // Same lock as confirming a booking, so a block and a confirm can't both pass their checks.
      await lockRoom(tx, input.roomId);
      const room = await tx.room.findUnique({ where: { id: input.roomId }, select: { name: true } });
      if (!room) throw new ActionError("That room no longer exists.", { roomId: "Choose a room." });

      const clashes = await tx.booking.findMany({
        where: {
          roomId: input.roomId,
          status: { in: [...OCCUPYING_STATUSES] },
          checkIn: { lt: endDate },
          checkOut: { gt: startDate },
        },
        select: { reservation: { select: { reference: true } } },
      });
      if (clashes.length > 0) {
        throw new ActionError(
          `${room.name} has ${clashes.length === 1 ? "a booking" : "bookings"} on these dates (${clashes
            .map((c) => c.reservation.reference)
            .join(", ")}). Move or cancel ${clashes.length === 1 ? "it" : "them"} first.`,
        );
      }

      const block = await tx.roomBlock.create({
        data: { roomId: input.roomId, startDate, endDate, reason: input.reason, createdById: actor.id },
      });
      await logActivity(tx, {
        userId: actor.id,
        action: "roomBlock.created",
        entityType: "RoomBlock",
        entityId: block.id,
        details: {
          room: room.name,
          startDate: toDateOnlyString(startDate),
          endDate: toDateOnlyString(endDate),
          reason: input.reason,
        },
      });
    }, BOOKING_TX_OPTIONS);

    revalidateAdmin();
    return { ok: true, message: "Room blocked." };
  });
}

export async function removeRoomBlock(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("rooms.blockDates");
    const { blockId } = parseForm(z.object({ blockId: id }), formData);

    await db.$transaction(async (tx) => {
      const block = await tx.roomBlock.findUnique({ where: { id: blockId }, include: { room: { select: { name: true } } } });
      if (!block) throw new ActionError("That block was already removed.");
      await tx.roomBlock.delete({ where: { id: blockId } });
      await logActivity(tx, {
        userId: actor.id,
        action: "roomBlock.removed",
        entityType: "RoomBlock",
        entityId: blockId,
        details: {
          room: block.room.name,
          startDate: toDateOnlyString(block.startDate),
          endDate: toDateOnlyString(block.endDate),
          reason: block.reason,
        },
      });
    });

    revalidateAdmin();
    return { ok: true, message: "Block removed. The room is available again." };
  });
}
