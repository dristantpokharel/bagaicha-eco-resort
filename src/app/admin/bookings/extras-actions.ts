"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { parseForm, runAction, type ActionResult } from "@/lib/actions";
import { addExtra, removeExtra } from "@/lib/housekeeping/extras-service";
import { HOUSEKEEPING_TX_OPTIONS } from "@/lib/housekeeping/service";
import { addExtraSchema, removeExtraSchema } from "@/lib/housekeeping/schemas";

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
    const result = await db.$transaction((tx) => addExtra(tx, { ...input, userId: actor.id }), HOUSEKEEPING_TX_OPTIONS);
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
