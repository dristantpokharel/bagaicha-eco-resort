import { createHash, timingSafeEqual } from "node:crypto";

const REALM = 'Basic realm="Staging", charset="UTF-8"';

const digest = (value: string) => createHash("sha256").update(value).digest();

/** True when the Authorization header is Basic auth with any username and the given password. */
export function passwordMatches(authorization: string | null, password: string): boolean {
  if (!authorization?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = atob(authorization.slice(6).trim());
  } catch {
    return false;
  }
  const separator = decoded.indexOf(":");
  if (separator === -1) return false;
  // Hash both sides so the comparison is constant-time and length-independent.
  return timingSafeEqual(digest(decoded.slice(separator + 1)), digest(password));
}

/**
 * Staging password gate (HTTP basic auth, any username). Returns a 401 response to send,
 * or null to let the request through. Off when STAGING_PASSWORD is unset or empty.
 */
export function stagingGate(request: Request, password: string | undefined): Response | null {
  if (!password) return null;
  if (passwordMatches(request.headers.get("authorization"), password)) return null;
  return new Response("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": REALM, "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" },
  });
}
