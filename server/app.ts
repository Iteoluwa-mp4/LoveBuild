import { Hono, type Context, type Next } from "hono";

import { siteSchema, statusSchema, type Site } from "../src/lib/site/schema";
import { createTokenVerifier, type TokenVerifier } from "./auth";
import { ApiError } from "./errors";
import { createDrizzleStore, type SiteStore } from "./store";

/**
 * The HTTP surface.
 *
 * The app is created with its dependencies rather than reaching for a module
 * singleton, so the route tests can put an in-memory store and a fake token
 * verifier behind the same handlers the deployment runs.
 *
 * Every owner route is explicitly wrapped in `requireAuth`. That is deliberately
 * repetitive: a wildcard auth middleware is one path-matching mistake away from
 * making a draft public, and this API has exactly one public read.
 */
type ApiEnv = { Variables: { uid: string } };

export type ApiDependencies = {
  store: SiteStore;
  verifyToken: TokenVerifier;
};

export function createApp({ store, verifyToken }: ApiDependencies): Hono<ApiEnv> {
  const app = new Hono<ApiEnv>().basePath("/api");

  const requireAuth = async (c: Context<ApiEnv>, next: Next) => {
    const header = c.req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
      throw new ApiError(401, "Sign in to open your sites.", "unauthorized");
    }

    try {
      const uid = await verifyToken(header.slice("Bearer ".length));
      c.set("uid", uid);
    } catch {
      throw new ApiError(401, "Your session has expired. Sign in again.", "unauthorized");
    }

    await next();
  };

  app.get("/health", (c) => c.json({ ok: true }));

  /**
   * The only unauthenticated site read. A draft behaves exactly as if it did
   * not exist, which is the same answer the Firestore rules gave a stranger.
   */
  app.get("/public/sites/:slug", async (c) => {
    const site = await store.getPublic(c.req.param("slug"));
    if (!site) {
      throw new ApiError(404, "This site is not published.", "not-found");
    }
    return c.json({ site });
  });

  app.get("/sites", requireAuth, async (c) => {
    return c.json({ sites: await store.list(c.get("uid")) });
  });

  app.post("/sites", requireAuth, async (c) => {
    const site = parseSite(await readJson(c));
    const created = await store.create(c.get("uid"), site);
    return c.json({ site: created }, 201);
  });

  app.get("/sites/:slug", requireAuth, async (c) => {
    const site = await store.get(c.get("uid"), slugOf(c));
    if (!site) {
      throw new ApiError(404, "This site does not exist, or it belongs to another account.", "not-found");
    }
    return c.json({ site });
  });

  app.put("/sites/:slug", requireAuth, async (c) => {
    const slug = slugOf(c);
    const site = parseSite(await readJson(c));

    if (site.slug !== slug) {
      throw new ApiError(
        400,
        "The web address cannot be changed after a site is created.",
        "slug-immutable",
        "slug",
      );
    }

    await store.save(c.get("uid"), site);
    return c.json({ ok: true });
  });

  app.patch("/sites/:slug/status", requireAuth, async (c) => {
    const slug = slugOf(c);
    const body = await readJson(c);
    const raw =
      typeof body === "object" && body !== null && "status" in body
        ? (body as { status: unknown }).status
        : undefined;

    const parsed = statusSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError(400, "Choose draft, submitted or published.", "invalid-status", "status");
    }

    await store.setStatus(c.get("uid"), slug, parsed.data);
    return c.json({ ok: true });
  });

  app.delete("/sites/:slug", requireAuth, async (c) => {
    await store.remove(c.get("uid"), slugOf(c));
    return c.body(null, 204);
  });

  app.notFound((c) => c.json({ error: "Not found." }, 404));

  app.onError((error, c) => {
    if (error instanceof ApiError) {
      const body: { error: string; code?: string; path?: string } = {
        error: error.message,
      };
      if (error.code) body.code = error.code;
      if (error.path) body.path = error.path;
      return c.json(body, error.status);
    }

    console.error(error);
    return c.json({ error: "Something went wrong. Try again." }, 500);
  });

  return app;
}

async function readJson(c: Context<ApiEnv>): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new ApiError(400, "Send a JSON body.", "invalid-json");
  }
}

function slugOf(c: Context<ApiEnv>): string {
  const slug = c.req.param("slug");
  if (!slug) {
    throw new ApiError(400, "No site address was given.", "invalid-slug", "slug");
  }
  return slug;
}

function parseSite(raw: unknown): Site {
  const result = siteSchema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join(".") || undefined;
    const suffix = path ? ` at ${path}` : "";
    throw new ApiError(
      400,
      `Not saved: ${first?.message ?? "the config is invalid"}${suffix}.`,
      "invalid-config",
      path,
    );
  }
  return result.data;
}

/**
 * The deployment entry point. `api/[...route].ts` only adapts this to Vercel;
 * `server/dev.ts` only adapts it to a local Node server.
 */
export default createApp({
  store: createDrizzleStore(),
  verifyToken: createTokenVerifier(),
});
