import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Session check + redirect only. No database calls here: every admin page and
// action re-checks the user against the database via src/lib/auth.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (req.auth?.user) return;

  const loginUrl = new URL("/login", req.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/admin/:path*"],
};
