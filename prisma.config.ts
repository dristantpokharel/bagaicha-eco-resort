import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Secrets live in .env.local only (see AGENTS.md). Hosted environments
// provide real env vars, which dotenv never overrides.
loadEnv({ path: ".env.local", quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // The CLI (migrate, studio) uses the direct, non-pooled connection.
  // The app itself connects through the Neon adapter with DATABASE_URL.
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
