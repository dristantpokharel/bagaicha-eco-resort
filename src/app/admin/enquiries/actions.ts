"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { ActionError, parseForm, runAction, type ActionResult } from "@/lib/actions";

const setStatusSchema = z.object({
  enquiryId: z.string().trim().min(1).max(64),
  status: z.enum(["NEW", "IN_PROGRESS", "CLOSED"]),
});

export async function setEnquiryStatus(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("enquiries.manage");
    const { enquiryId, status } = parseForm(setStatusSchema, formData);

    await db.$transaction(async (tx) => {
      const before = await tx.enquiry.findUnique({ where: { id: enquiryId }, select: { status: true } });
      if (!before) throw new ActionError("That enquiry no longer exists.");
      if (before.status === status) return;
      await tx.enquiry.update({ where: { id: enquiryId }, data: { status } });
      await logActivity(tx, {
        userId: actor.id,
        action: "enquiry.statusChanged",
        entityType: "Enquiry",
        entityId: enquiryId,
        details: { from: before.status, to: status },
      });
    });

    revalidatePath("/admin", "layout");
    return { ok: true, message: "Status updated." };
  });
}
