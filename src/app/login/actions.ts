"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";
import { loginSchema, safeCallbackUrl } from "@/lib/auth/schemas";

export type LoginState = { error?: string; email?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const parsed = loginSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: "Enter your email and password.", email };

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: safeCallbackUrl(formData.get("callbackUrl")),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error:
          error instanceof CredentialsSignin && error.code === "rate_limited"
            ? "Too many sign-in attempts. Please wait a few minutes and try again."
            : error.type === "CredentialsSignin"
            ? "Incorrect email or password, or the account is inactive."
            : "Sign-in failed. Please try again.",
        email,
      };
    }
    // signIn redirects by throwing; let Next handle it.
    throw error;
  }
  return {};
}
