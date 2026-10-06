import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { loginSchema } from "@/lib/auth/schemas";
import { clientIpFromHeaders, hitRateLimit } from "@/lib/rate-limit";

/** Thrown from authorize() so the login form can say "too many attempts". */
export class LoginRateLimited extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Enforced here, not in the login action, so posting straight to the
        // Auth.js endpoint can't skip it. Counts every attempt, per IP and per email.
        const ip = clientIpFromHeaders(request.headers);
        const [byIp, byEmail] = await Promise.all([hitRateLimit("loginIp", ip), hitRateLimit("loginEmail", email)]);
        if (!byIp.allowed || !byEmail.allowed) throw new LoginRateLimited();

        const user = await db.user.findUnique({ where: { email } });
        const passwordOk = await verifyPassword(password, user?.passwordHash);
        if (!user || !passwordOk || !user.isActive) return null;

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
});
