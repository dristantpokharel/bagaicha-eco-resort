/**
 * Idempotent seed. Creates the first SUPERUSER from SUPERUSER_EMAIL /
 * SUPERUSER_PASSWORD only if no superuser exists yet.
 * Never updates or deletes anything, and never prints secret values.
 */
import { config as loadEnv } from "dotenv";
import { PrismaNeon } from "@prisma/adapter-neon";
import { z } from "zod";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { emailSchema, newPasswordSchema } from "../src/lib/auth/schemas";
import { hashPassword } from "../src/lib/auth/password";
import { logActivity } from "../src/lib/activity-log";

loadEnv({ path: ".env.local", quiet: true });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, { error: "DATABASE_URL is not set" }),
  SUPERUSER_EMAIL: emailSchema,
  SUPERUSER_PASSWORD: newPasswordSchema,
});

async function main() {
  const env = envSchema.safeParse(process.env);
  if (!env.success) {
    // Report which variables are wrong, never their values.
    const problems = env.error.issues.map((issue) => `${String(issue.path[0])}: ${issue.message}`);
    throw new Error(`Seed environment is invalid:\n  ${problems.join("\n  ")}`);
  }
  const { DATABASE_URL, SUPERUSER_EMAIL, SUPERUSER_PASSWORD } = env.data;

  const db = new PrismaClient({ adapter: new PrismaNeon({ connectionString: DATABASE_URL }) });
  try {
    const existing = await db.user.count({ where: { role: "SUPERUSER" } });
    if (existing > 0) {
      console.log(`Seed: ${existing} superuser(s) already exist. Nothing to do.`);
      return;
    }

    const passwordHash = await hashPassword(SUPERUSER_PASSWORD);
    try {
      await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { name: "Superuser", email: SUPERUSER_EMAIL, passwordHash, role: "SUPERUSER" },
        });
        await logActivity(tx, {
          userId: null,
          action: "user.created",
          entityType: "User",
          entityId: user.id,
          details: { role: user.role, source: "seed" },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new Error(
          "Seed: SUPERUSER_EMAIL already belongs to a non-superuser account. Not changing it; use a different email.",
        );
      }
      throw error;
    }
    console.log("Seed: superuser created.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Seed failed.");
  process.exit(1);
});
