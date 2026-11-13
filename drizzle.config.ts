import { existsSync } from "node:fs";

import { defineConfig } from "drizzle-kit";

/**
 * Migrations use the direct Neon connection, not the pooled one. DDL can hold a
 * session open, and the direct endpoint is the one that supports that cleanly.
 * The runtime API still uses `DATABASE_URL` (pooled).
 */
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  throw new Error(
    "DATABASE_URL_UNPOOLED is not set. Run `neon env pull` or add it to .env.local.",
  );
}

export default defineConfig({
  schema: "./server/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
