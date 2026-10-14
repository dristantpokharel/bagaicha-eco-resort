"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/auth";
import { parseForm, runAction, type ActionResult } from "@/lib/actions";
import { addExtra, applyExtra, removeExtra } from "@/lib/housekeeping/extras-service";
import { HOUSEKEEPING_TX_OPTIONS } from "@/lib/housekeeping/service";
import { addExtraSchema, applyExtraSchema, removeExtraSchema } from "@/lib/housekeeping/schemas";

function revalidateExtras() {
  revalidatePath("/admin/bookings/[id]", "page");
  revalidatePath("/admin/housekeeping");
  revalidatePath("/admin/inventory");
}

/** Staff add an extra to one booking line, before or during the stay. */
export async function addExtraAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("housekeeping.work");
    const input = parseForm(addExtraSchema, formData);
    const result = await db
      .$transaction((tx) => addExtra(tx, { ...input, userId: actor.id }), HOUSEKEEPING_TX_OPTIONS)
      .catch((error) => {
        // The unique submission id: the same attempt landed twice at once.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { summary: "Already added.", duplicate: true };
        throw error;
      });
    revalidateExtras();
    return { ok: true, message: result.summary };
  });
}

/** Removes an extra that has not been placed in the room yet. */
export async function removeExtraAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("housekeeping.work");
    const { extraId } = parseForm(removeExtraSchema, formData);
    const result = await db.$transaction((tx) => removeExtra(tx, { extraId, userId: actor.id }), HOUSEKEEPING_TX_OPTIONS);
    revalidateExtras();
    return { ok: true, message: result.summary };
  });
}

/** Places a waiting extra now, when the room is already set up for the guest. Same path as adding one. */
export async function applyExtraAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("housekeeping.work");
    const { extraId } = parseForm(applyExtraSchema, formData);
    const result = await db.$transaction((tx) => applyExtra(tx, { extraId, userId: actor.id }), HOUSEKEEPING_TX_OPTIONS);
    revalidateExtras();
    return { ok: true, message: result.summary };
  });
}
