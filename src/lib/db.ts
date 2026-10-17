import { PrismaNeon } from "@prisma/adapter-neon";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}

// Reuse one client across hot reloads in development. The cache is keyed by the generated model list, so a
// client made before `prisma generate` (a new model after a merge or branch switch) is replaced, not reused.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaModels?: string };
const models = Object.keys(Prisma.ModelName).join(",");

export const db = globalForPrisma.prisma && globalForPrisma.prismaModels === models ? globalForPrisma.prisma : createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaModels = models;
}

/** Booking transactions do several round-trips to Neon; Prisma's 5 s default is tight. */
export const BOOKING_TX_OPTIONS = { timeout: 15_000, maxWait: 10_000 } as const;
