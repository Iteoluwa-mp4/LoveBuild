import { handle } from "hono/vercel";

import app from "../server/app";

/**
 * Vercel entry point.
 *
 * Edge rather than Node because every dependency here is web-standard: Hono,
 * `jose`, the Neon HTTP driver and `fetch`. That also means this same app can be
 * served by `server/dev.ts` through `@hono/node-server` without a second adapter.
 */
export const config = { runtime: "edge" };

export default handle(app);
