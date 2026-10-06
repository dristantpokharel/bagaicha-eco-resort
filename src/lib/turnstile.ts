const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileResult = { ok: true } | { ok: false; reason: "missing-token" | "not-configured" | "failed" | "unreachable" };

/**
 * Verifies a Turnstile token server-side. Fails closed: no secret, no token,
 * a network error or a failed check all reject the submission.
 * `secret` is overridable for tests (Cloudflare's official test keys).
 */
export async function verifyTurnstile(
  token: unknown,
  options: { ip?: string; expectedAction?: string; secret?: string } = {},
): Promise<TurnstileResult> {
  if (typeof token !== "string" || token.length === 0 || token.length > 2048) return { ok: false, reason: "missing-token" };
  const secret = options.secret ?? process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, reason: "not-configured" };

  const body = new URLSearchParams({ secret, response: token });
  if (options.ip && options.ip !== "unknown") body.set("remoteip", options.ip);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { ok: false, reason: "unreachable" };
    const data = (await response.json()) as { success?: boolean; action?: string };
    if (data.success !== true) return { ok: false, reason: "failed" };
    if (options.expectedAction && data.action && data.action !== options.expectedAction) {
      return { ok: false, reason: "failed" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}

export function turnstileErrorMessage(reason: Exclude<TurnstileResult, { ok: true }>["reason"]): string {
  switch (reason) {
    case "missing-token":
      return "Please wait for the security check to finish, then try again.";
    case "not-configured":
    case "unreachable":
      return "We couldn't run the security check right now. Please try again in a moment.";
    case "failed":
      return "The security check failed. Please reload the page and try again.";
  }
}
