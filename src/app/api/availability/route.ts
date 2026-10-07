import { NextResponse } from "next/server";
import { getAvailabilityPayload } from "@/lib/booking/availability-data";
import { clientIpFromHeaders, hitRateLimit } from "@/lib/rate-limit";

/**
 * Public, read-only. Per room type, which of the next 365 nights are sold out.
 * No counts, room names or booking details. Cached for a minute (server and CDN).
 */
export async function GET(request: Request) {
  const limit = await hitRateLimit("availability", clientIpFromHeaders(request.headers));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const payload = await getAvailabilityPayload();
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=60" },
  });
}
