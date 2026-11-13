import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

/**
 * Neon, over the serverless HTTP driver.
 *
 * HTTP rather than a WebSocket pool because every request is short and
 * independent, and because it works on both Vercel's Node and Edge runtimes.
 * The connection is created lazily so importing the app (or running the health
 * check) does not require a database credential.
 */
function createDb(url: string) {
  return drizzle(neon(url), { schema });
}

export type Database = ReturnType<typeof createDb>;

let instance: Database | null = null;

export function getDb(): Database {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add the pooled Neon connection string to the server environment.",
    );
  }

  instance ??= createDb(url);
  return instance;
}
