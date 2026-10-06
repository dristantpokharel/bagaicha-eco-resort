import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface User {
    role: Role;
    tokenVersion: number;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      tokenVersion: number;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    tokenVersion?: number;
  }
}
