"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { ActionError, parseForm, runAction, type ActionResult } from "@/lib/actions";
import { country, guestName, longText, optionalEmail, optionalPhone } from "@/lib/booking/schemas";

const updateGuestSchema = z.object({
  guestId: z.string().trim().min(1).max(64),
  name: guestName,
  phone: optionalPhone,
  email: optionalEmail,
  country,
  notes: longText(2000),
});

export async function updateGuest(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("bookings.manage");
    const { guestId, ...input } = parseForm(updateGuestSchema, formData);

    await db.$transaction(async (tx) => {
      const before = await tx.guest.findUnique({ where: { id: guestId } });
      if (!before) throw new ActionError("That guest no longer exists.");
      const next = {
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        country: input.country ?? null,
        notes: input.notes ?? null,
      };
      const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => before[k] !== next[k]);
      if (changed.length === 0) return;
      await tx.guest.update({ where: { id: guestId }, data: next });
      await logActivity(tx, {
        userId: actor.id,
        action: "guest.updated",
        entityType: "Guest",
        entityId: guestId,
        // Names of the changed fields only: contact details stay out of the log.
        details: { fields: changed },
      });
    });

    revalidatePath("/admin", "layout");
    return { ok: true, message: "Guest saved." };
  });
}
