import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** Booking transactions do several round-trips to Neon; Prisma's 5 s default is tight. */
export const BOOKING_TX_OPTIONS = { timeout: 15_000, maxWait: 10_000 } as const;
