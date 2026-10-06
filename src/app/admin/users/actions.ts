"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requirePermission } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import { logActivity } from "@/lib/activity-log";
import { ActionError, parseForm, runAction, type ActionResult } from "@/lib/actions";
import { changeRoleSchema, createUserSchema, resetPasswordSchema, setActiveSchema } from "./schemas";

const USERS_PATH = "/admin/users";

async function findTarget(tx: Prisma.TransactionClient, userId: string) {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user) throw new ActionError("That user no longer exists.");
  return user;
}

export async function createUser(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("users.manage");
    const input = parseForm(createUserSchema, formData);
    const passwordHash = await hashPassword(input.password);

    try {
      await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { name: input.name, email: input.email, role: input.role, passwordHash },
        });
        await logActivity(tx, {
          userId: actor.id,
          action: "user.created",
          entityType: "User",
          entityId: user.id,
          details: { email: user.email, role: user.role },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ActionError("A user with this email already exists.", { email: "Already in use." });
      }
      throw error;
    }

    revalidatePath(USERS_PATH);
    return { ok: true, message: `${input.name} was added as ${input.role === "ADMIN" ? "an Admin" : "Staff"}.` };
  });
}

export async function changeRole(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("users.manage");
    const input = parseForm(changeRoleSchema, formData);

    const changed = await db.$transaction(async (tx) => {
      const target = await findTarget(tx, input.userId);
      if (target.role === "SUPERUSER") throw new ActionError("Superuser roles can't be changed here.");
      if (target.role === input.role) return false;

      await tx.user.update({ where: { id: target.id }, data: { role: input.role } });
      await logActivity(tx, {
        userId: actor.id,
        action: "user.role_changed",
        entityType: "User",
        entityId: target.id,
        details: { from: target.role, to: input.role },
      });
      return true;
    });

    revalidatePath(USERS_PATH);
    return { ok: true, message: changed ? "Role updated." : "Role unchanged." };
  });
}

export async function setActive(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("users.manage");
    const input = parseForm(setActiveSchema, formData);

    await db.$transaction(
      async (tx) => {
        const target = await findTarget(tx, input.userId);
        if (target.isActive === input.isActive) return;

        if (!input.isActive) {
          if (target.id === actor.id) throw new ActionError("You can't deactivate your own account.");
          if (target.role === "SUPERUSER") {
            const activeSuperusers = await tx.user.count({ where: { role: "SUPERUSER", isActive: true } });
            if (activeSuperusers <= 1) throw new ActionError("You can't deactivate the last active superuser.");
          }
        }

        await tx.user.update({
          where: { id: target.id },
          // Deactivation also revokes any open sessions.
          data: input.isActive ? { isActive: true } : { isActive: false, tokenVersion: { increment: 1 } },
        });
        await logActivity(tx, {
          userId: actor.id,
          action: input.isActive ? "user.activated" : "user.deactivated",
          entityType: "User",
          entityId: target.id,
        });
      },
      // Serializable so two concurrent deactivations can't both pass the last-superuser check.
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath(USERS_PATH);
    return { ok: true, message: input.isActive ? "User activated." : "User deactivated and signed out." };
  });
}

export async function resetPassword(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requirePermission("users.manage");
    const input = parseForm(resetPasswordSchema, formData);
    const passwordHash = await hashPassword(input.password);

    await db.$transaction(async (tx) => {
      const target = await findTarget(tx, input.userId);
      await tx.user.update({
        where: { id: target.id },
        // Revoke existing sessions so the old password stops working everywhere.
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
      await logActivity(tx, {
        userId: actor.id,
        action: "user.password_reset",
        entityType: "User",
        entityId: target.id,
      });
    });

    revalidatePath(USERS_PATH);
    return { ok: true, message: "Password reset. Existing sessions for this user were signed out." };
  });
}
