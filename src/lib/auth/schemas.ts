import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email({ error: "Enter a valid email address." }));

/** bcrypt only uses the first 72 bytes of a password. */
const MAX_PASSWORD_BYTES = 72;
export const MIN_PASSWORD_LENGTH = 10;

/** Policy for passwords that are being set (create user, reset, seed). */
export const newPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, {
    error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  })
  .refine((value) => new TextEncoder().encode(value).length <= MAX_PASSWORD_BYTES, {
    error: `Password must be at most ${MAX_PASSWORD_BYTES} bytes.`,
  });

export const loginSchema = z.object({
  email: emailSchema,
  // No policy on login, just sane bounds.
  password: z.string().min(1).max(256),
});
