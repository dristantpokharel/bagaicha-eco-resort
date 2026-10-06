import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import type { Role } from "@/generated/prisma/enums";
import { can, type Permission } from "./permissions";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export class AuthorizationError extends Error {
  constructor(readonly reason: "unauthenticated" | "forbidden") {
    super(reason === "unauthenticated" ? "Please sign in again." : "You don't have permission to do that.");
    this.name = "AuthorizationError";
  }
}

/**
 * The signed-in user, re-read from the database. The JWT only identifies the
 * user; active state and role always come from the DB. Returns null if the
 * session is missing, the user is inactive, or the session was revoked
 * (tokenVersion bumped by a password reset or deactivation).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const sessionUser = session?.user;
  if (!sessionUser?.id) return null;

  const user = await db.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, name: true, email: true, role: true, isActive: true, tokenVersion: true },
  });
  if (!user || !user.isActive || user.tokenVersion !== sessionUser.tokenVersion) return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role };
});

// ─── For server actions and route handlers: throw AuthorizationError ─────────

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthorizationError("unauthenticated");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new AuthorizationError("forbidden");
  return user;
}

export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) throw new AuthorizationError("forbidden");
  return user;
}

// ─── For pages and layouts: redirect instead of throwing ─────────────────────

export async function requirePageUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reason=session-ended");
  return user;
}

export async function requirePagePermission(permission: Permission): Promise<CurrentUser> {
  const user = await requirePageUser();
  if (!can(user.role, permission)) redirect("/admin/forbidden");
  return user;
}
