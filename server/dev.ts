import { serve } from "@hono/node-server";
import { loadEnv } from "vite";

/**
 * The local API server.
 *
 * Vite only reads `.env.local` for the browser bundle, so the server loads the
 * same file here before importing the app. The import is dynamic on purpose:
 * `server/app.ts` constructs its database accessor at module scope, and the
 * connection string must already be in `process.env` by then.
 */
const env = loadEnv("development", process.cwd(), "");
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const { default: app } = await import("./app");

const port = Number(process.env.API_PORT ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
