import { z } from "zod";
import { newPasswordSchema } from "@/lib/auth/schemas";

export const nameSchema = z.object({
  name: z.string().trim().min(1, { error: "Enter your name." }).max(100),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "Enter your current password." }).max(256),
    newPassword: newPasswordSchema,
    confirmPassword: z.string().max(256),
  })
  .refine((input) => input.newPassword === input.confirmPassword, {
    error: "The new passwords don't match.",
    path: ["confirmPassword"],
  })
  .refine((input) => input.newPassword !== input.currentPassword, {
    error: "Choose a password different from your current one.",
    path: ["newPassword"],
  });
