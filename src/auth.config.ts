import type { NextAuthConfig } from "next-auth";

/**
 * Database-free Auth.js config, shared by the proxy and the full auth setup.
 * Providers that touch the database are added in src/auth.ts.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 }, // 12 hours
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.tokenVersion = user.tokenVersion;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id && token.role && token.tokenVersion !== undefined) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.tokenVersion = token.tokenVersion;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
