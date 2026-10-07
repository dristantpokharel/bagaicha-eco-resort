import NextAuth from "next-auth";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { authConfig } from "@/auth.config";
import { stagingGate } from "@/lib/staging-gate";

// No database calls here. The admin check is a session redirect only: every admin
// page and action re-checks the user against the database via src/lib/auth.
const { auth } = NextAuth(authConfig);

// Auth.js overloads `auth(handler)` for route handlers and proxies; in a proxy it takes (request, event).
const adminSession = auth((req) => {
  if (req.auth?.user) return;

  const loginUrl = new URL("/login", req.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}) as unknown as (req: NextRequest, event: NextFetchEvent) => Promise<Response | void>;

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  // Staging password gate first (when STAGING_PASSWORD is set), then the admin session check.
  // robots.txt stays readable so crawlers can see "disallow all".
  if (req.nextUrl.pathname !== "/robots.txt") {
    const denied = stagingGate(req, process.env.STAGING_PASSWORD);
    if (denied) return denied;
  }

  if (req.nextUrl.pathname === "/admin" || req.nextUrl.pathname.startsWith("/admin/")) {
    return adminSession(req, event);
  }
  return NextResponse.next();
}

export const config = {
  // Every route except Next's static build output and Netlify's own internal paths.
  matcher: ["/((?!_next/static|\\.netlify/).*)"],
};
