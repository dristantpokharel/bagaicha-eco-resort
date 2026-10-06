import { z } from "zod";
import { emailSchema, newPasswordSchema } from "@/lib/auth/schemas";

/** Roles a superuser can assign from the UI. SUPERUSER is seed-only. */
export const ASSIGNABLE_ROLES = ["ADMIN", "STAFF"] as const;

const userId = z.string().trim().min(1).max(64);

export const createUserSchema = z.object({
  name: z.string().trim().min(1, { error: "Enter a name." }).max(100),
  email: emailSchema,
  role: z.enum(ASSIGNABLE_ROLES, { error: "Choose Admin or Staff." }),
  password: newPasswordSchema,
});

export const changeRoleSchema = z.object({
  userId,
  role: z.enum(ASSIGNABLE_ROLES, { error: "Choose Admin or Staff." }),
});

export const setActiveSchema = z.object({
  userId,
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const resetPasswordSchema = z.object({
  userId,
  password: newPasswordSchema,
});

export const updateDetailsSchema = z.object({
  userId,
  name: z.string().trim().min(1, { error: "Enter a name." }).max(100),
  email: emailSchema,
});
