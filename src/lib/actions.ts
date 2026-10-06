import type { z } from "zod";
import { AuthorizationError } from "@/lib/auth/session";

/** Result shape returned by server actions to client forms. */
export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Expected, user-facing failure inside an action (validation, business rule). */
export class ActionError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

/**
 * Runs an action body and turns expected failures into an ActionResult.
 * The body is responsible for calling requirePermission / requireRole first.
 * Unexpected errors are logged without user data and reported generically.
 */
export async function runAction(body: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await body();
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof ActionError) {
      return {
        ok: false,
        error: error.message,
        fieldErrors: error instanceof ActionError ? error.fieldErrors : undefined,
      };
    }
    console.error("Action failed:", error instanceof Error ? error.name : "unknown error");
    return { ok: false, error: "Something went wrong. Nothing was saved. Please try again." };
  }
}

/** Validate FormData with Zod; throws an ActionError with per-field messages. */
export function parseForm<S extends z.ZodType>(schema: S, formData: FormData): z.output<S> {
  const result = schema.safeParse(Object.fromEntries(formData));
  if (result.success) return result.data;

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
  }
  throw new ActionError("Please fix the highlighted fields.", fieldErrors);
}
