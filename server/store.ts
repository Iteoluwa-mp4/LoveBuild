import { and, desc, eq } from "drizzle-orm";

import { parseStoredSite } from "../src/lib/site/parseSite";
import type { SiteSummary } from "../src/lib/site/repository";
import type { Site, SiteStatus } from "../src/lib/site/schema";
import { randomSlugSuffix, suffixSlug } from "../src/lib/site/slug";
import { getDb } from "./db";
import { ApiError } from "./errors";
import { sites } from "./schema";

/**
 * The storage operations the API needs, separated from HTTP.
 *
 * Keeping this an interface means the route tests can use an in-memory store
 * and assert the contract — status codes, ownership, public visibility — without
 * needing a live Neon branch.
 */
export interface SiteStore {
  list(ownerId: string): Promise<SiteSummary[]>;
  get(ownerId: string, slug: string): Promise<Site | null>;
  getPublic(slug: string): Promise<Site | null>;
  create(ownerId: string, site: Site): Promise<Site>;
  save(ownerId: string, site: Site): Promise<void>;
  setStatus(ownerId: string, slug: string, status: SiteStatus): Promise<void>;
  remove(ownerId: string, slug: string): Promise<void>;
}

const MAX_SLUG_ATTEMPTS = 6;

export function createDrizzleStore(): SiteStore {
  return {
    async list(ownerId) {
      const db = getDb();
      const rows = await db
        .select({
          slug: sites.slug,
          status: sites.status,
          name: sites.name,
          updatedAt: sites.updatedAt,
        })
        .from(sites)
        .where(eq(sites.ownerId, ownerId))
        .orderBy(desc(sites.updatedAt));

      return rows.map((row) => ({
        slug: row.slug,
        status: row.status,
        name: row.name,
        updatedAt: row.updatedAt.toISOString(),
      }));
    },

    async get(ownerId, slug) {
      const db = getDb();
      const [row] = await db
        .select({ site: sites.site })
        .from(sites)
        .where(and(eq(sites.slug, slug), eq(sites.ownerId, ownerId)))
        .limit(1);

      return row ? readSite(row.site, slug) : null;
    },

    async getPublic(slug) {
      const db = getDb();
      const [row] = await db
        .select({ site: sites.site })
        .from(sites)
        .where(and(eq(sites.slug, slug), eq(sites.status, "published")))
        .limit(1);

      return row ? readSite(row.site, slug) : null;
    },

    async create(ownerId, site) {
      const db = getDb();
      const base = site.slug;

      for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
        // The first attempt is always the address the author asked for. Only a
        // collision earns a suffix.
        const slug = attempt === 0 ? base : suffixSlug(base, randomSlugSuffix());
        const candidate: Site = { ...site, slug };

        try {
          const [row] = await db
            .insert(sites)
            .values({
              slug,
              ownerId,
              status: "draft",
              schemaVersion: candidate.version,
              name: candidate.identity.name || slug,
              site: candidate,
            })
            .returning({ site: sites.site });

          if (!row) throw new ApiError(500, "Could not create this site.");
          return readSite(row.site, slug);
        } catch (cause) {
          if (isUniqueViolation(cause)) continue;
          throw cause;
        }
      }

      throw new ApiError(
        409,
        "Could not find a free web address. Try a different name.",
        "slug-taken",
      );
    },

    async save(ownerId, site) {
      const db = getDb();
      const result = await db
        .update(sites)
        .set({
          site,
          name: site.identity.name || site.slug,
          schemaVersion: site.version,
          updatedAt: new Date(),
        })
        .where(and(eq(sites.slug, site.slug), eq(sites.ownerId, ownerId)))
        .returning({ slug: sites.slug });

      if (result.length === 0) {
        throw new ApiError(
          404,
          "This site no longer exists. It may have been deleted.",
          "not-found",
        );
      }
    },

    async setStatus(ownerId, slug, status) {
      const db = getDb();
      const result = await db
        .update(sites)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(sites.slug, slug), eq(sites.ownerId, ownerId)))
        .returning({ slug: sites.slug });

      if (result.length === 0) {
        throw new ApiError(
          404,
          `There is no saved site called "${slug}" to publish.`,
          "not-found",
        );
      }
    },

    async remove(ownerId, slug) {
      const db = getDb();
      await db
        .delete(sites)
        .where(and(eq(sites.slug, slug), eq(sites.ownerId, ownerId)));
    },
  };
}

/**
 * The row is JSONB, so a schema change between deployments can leave an old
 * config behind. Validate on the way out for the same reason the Firestore
 * repository does: a half-compatible object must not reach the renderer.
 */
function readSite(raw: unknown, slug: string): Site {
  try {
    return parseStoredSite(raw, slug);
  } catch (cause) {
    throw new ApiError(
      500,
      cause instanceof Error ? cause.message : `Saved config for "${slug}" is invalid.`,
      "invalid-config",
    );
  }
}

function isUniqueViolation(cause: unknown): boolean {
  if (typeof cause !== "object" || cause === null) return false;

  const code = (cause as { code?: unknown }).code;
  if (code === "23505") return true;

  const message = (cause as { message?: unknown }).message;
  return (
    typeof message === "string" &&
    /duplicate key value|unique constraint|sites_pkey/i.test(message)
  );
}
