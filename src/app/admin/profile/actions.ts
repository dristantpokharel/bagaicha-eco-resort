"use server";

import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { logActivity } from "@/lib/activity-log";
import { ActionError, parseForm, runAction, type ActionResult } from "@/lib/actions";
import { changePasswordSchema, nameSchema } from "./schemas";

/** Any signed-in user can rename themselves. */
export async function updateOwnName(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const user = await requireUser();
    const { name } = parseForm(nameSchema, formData);
    if (name === user.name) return { ok: true, message: "Name unchanged." };

    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { name } });
      await logActivity(tx, {
        userId: user.id,
        action: "user.name_changed",
        entityType: "User",
        entityId: user.id,
        details: { from: user.name, to: name, self: true },
      });
    });

    revalidatePath("/admin", "layout");
    return { ok: true, message: "Name saved." };
  });
}

/**
 * Any signed-in user can change their own password after confirming the current one.
 * All sessions (including this one) are revoked, so the user signs in again.
 */
export async function changeOwnPassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const user = await requireUser();
    const input = parseForm(changePasswordSchema, formData);

    const record = await db.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
    const currentOk = await verifyPassword(input.currentPassword, record?.passwordHash);
    if (!currentOk) {
      throw new ActionError("Your current password is incorrect.", { currentPassword: "Incorrect password." });
    }

    const passwordHash = await hashPassword(input.newPassword);
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      await logActivity(tx, {
        userId: user.id,
        action: "user.password_changed",
        entityType: "User",
        entityId: user.id,
      });
    });
    return { ok: true, message: "Password changed." };
  });

  // signOut redirects (throws), so it runs outside runAction's try/catch.
  if (result.ok) await signOut({ redirectTo: "/login?reason=password-changed" });
  return result;
}
