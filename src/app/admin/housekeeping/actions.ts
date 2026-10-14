"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/auth";
import { ActionError, parseForm, runAction, type ActionResult } from "@/lib/actions";
import { completeInspection, completePrep, HOUSEKEEPING_TX_OPTIONS } from "@/lib/housekeeping/service";
import { setRoomStatus } from "@/lib/housekeeping/room-status";
import { savePar, type ParScope } from "@/lib/housekeeping/par-service";
import { fieldsWithPrefix, inspectionEntries, inspectionSchema, prepSchema, saveParSchema, setStatusSchema } from "@/lib/housekeeping/schemas";

function revalidateHousekeeping() {
  revalidatePath("/admin/housekeeping");
  revalidatePath("/admin");
  revalidatePath("/admin/bookings/calendar");
  revalidatePath("/admin/inventory");
}

/** The unique key on (room, kind, dirty cycle) is the last line of defence against a double completion. */
function friendlyConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ActionError("Someone else just completed this. Reload the page.");
  }
  throw error;
}

export async function completePrepAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("housekeeping.work");
    const { roomId, cycle, acknowledgeShortfall } = parseForm(prepSchema, formData);
    const quantities = fieldsWithPrefix(formData, "qty");
    const result = await db
      .$transaction((tx) => completePrep(tx, { roomId, cycle, userId: actor.id, quantities, acknowledgeShortfall }), HOUSEKEEPING_TX_OPTIONS)
      .catch(friendlyConflict);
    revalidateHousekeeping();
    return { ok: true, message: result.summary };
  });
}

export async function completeInspectionAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("housekeeping.work");
    const { roomId, cycle } = parseForm(inspectionSchema, formData);
    const entries = inspectionEntries(formData);
    const result = await db
      .$transaction((tx) => completeInspection(tx, { roomId, cycle, userId: actor.id, entries }), HOUSEKEEPING_TX_OPTIONS)
      .catch(friendlyConflict);
    revalidateHousekeeping();
    return { ok: true, message: result.summary };
  });
}

export async function setRoomStatusAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("housekeeping.work");
    const { roomId, status, note } = parseForm(setStatusSchema, formData);
    const message = await db.$transaction((tx) => setRoomStatus(tx, { roomId, to: status, note, userId: actor.id }));
    revalidateHousekeeping();
    return { ok: true, message };
  });
}

// ─── Par lists (Admin and up) ────────────────────────────────────────────────

export async function saveParAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("inventory.managePar");
    const { roomTypeId, roomId } = parseForm(saveParSchema, formData);
    const desired = fieldsWithPrefix(formData, "par");
    const scope: ParScope = roomId ? { kind: "room", roomId } : { kind: "roomType", roomTypeId: roomTypeId! };
    const result = await db.$transaction((tx) => savePar(tx, { scope, desired, userId: actor.id }), HOUSEKEEPING_TX_OPTIONS);
    revalidatePath("/admin/rooms");
    revalidatePath("/admin/housekeeping");
    return { ok: true, message: result.message };
  });
}
