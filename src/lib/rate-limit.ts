import { createHmac } from "node:crypto";
import { db } from "@/lib/db";

/** Fixed-window limits. Counters live in Postgres so they work across serverless instances. */
export const RATE_LIMITS = {
  booking: { limit: 5, windowSeconds: 60 * 60 },
  enquiry: { limit: 5, windowSeconds: 60 * 60 },
  loginIp: { limit: 10, windowSeconds: 15 * 60 },
  loginEmail: { limit: 5, windowSeconds: 15 * 60 },
} as const satisfies Record<string, { limit: number; windowSeconds: number }>;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

/** Identifiers (IPs, emails) are stored only as a keyed hash. */
function hashIdentifier(identifier: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(identifier.toLowerCase()).digest("hex").slice(0, 32);
}

/**
 * Counts one attempt for (bucket, identifier) and says whether it is within
 * the limit. One atomic upsert per call; no read-then-write race.
 */
export async function hitRateLimit(
  bucket: RateLimitBucket,
  identifier: string,
  now = new Date(),
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = RATE_LIMITS[bucket];
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const key = `${bucket}:${hashIdentifier(identifier)}`;

  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limits ("key", "windowStart", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = rate_limits."count" + 1
    RETURNING "count"`;

  // Opportunistic cleanup of long-expired windows (about 1 call in 50).
  if (Math.random() < 0.02) {
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    await db.rateLimit.deleteMany({ where: { windowStart: { lt: cutoff } } }).catch(() => undefined);
  }

  const allowed = rows[0].count <= limit;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000));
  return { allowed, retryAfterSeconds };
}

/** Client IP: Netlify's header first (not client-settable), then the first X-Forwarded-For hop. */
export function clientIpFromHeaders(headers: Headers): string {
  return (
    headers.get("x-nf-client-connection-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}

export function rateLimitMessage(retryAfterSeconds: number): string {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
