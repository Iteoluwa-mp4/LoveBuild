import { and, desc, eq, gt, sql } from "drizzle-orm";

import type { SiteAllowance } from "../src/lib/site/entitlement";
import { parseStoredSite } from "../src/lib/site/parseSite";
import type { SiteSummary } from "../src/lib/site/repository";
import type { Site, SiteStatus } from "../src/lib/site/schema";
import { randomSlugSuffix, suffixSlug } from "../src/lib/site/slug";
import { getDb } from "./db";
import { ApiError } from "./errors";
import { accountEntitlements, deviceClaims, sites } from "./schema";

/**
 * The storage operations the API needs, separated from HTTP.
 *
 * Keeping this an interface means the route tests can use an in-memory store
 * and assert the contract — status codes, ownership, public visibility — without
 * needing a live Neon branch.
 */
export interface SiteStore {
  /**
   * What this account and device may create next.
   *
   * Parked while site creation is free: the current API does not call this and
   * no longer spends a free allowance. It stays on the interface for a future
   * paid mode, where the same device claim would be reused.
   */
  allowance(ownerId: string, deviceHash: string): Promise<SiteAllowance>;

  list(ownerId: string): Promise<SiteSummary[]>;
  get(ownerId: string, slug: string): Promise<Site | null>;
  getPublic(slug: string): Promise<Site | null>;

  /**
   * The low-level insert. The current free-for-everyone route uses this
   * directly; `createEntitled` is kept for the parked allowance mode.
   */
  create(ownerId: string, site: Site): Promise<Site>;

  /**
   * Creates a site under the one-free-site allowance.
   *
   * Parked while site creation is free. The reservation happens here rather
   * than in the route so a future paid mode can make two requests race for the
   * same free site without both winning. The device row is the unique
   * constraint; the account flag is the second gate.
   */
  createEntitled(ownerId: string, site: Site, deviceHash: string): Promise<Site>;

  save(ownerId: string, site: Site): Promise<void>;
  setStatus(ownerId: string, slug: string, status: SiteStatus): Promise<void>;
  remove(ownerId: string, slug: string): Promise<void>;
  /**
   * Every site the account owns, in one statement. Returns how many went.
   *
   * Account deletion needs this as a single operation: a loop over `remove`
   * from the browser would be a partial failure waiting to happen, and the
   * row that survives is a published site nobody can take down.
   *
   * Deliberately leaves `account_entitlements` and `device_claims` alone. The
   * free site was used; deleting the account must not turn that into a fresh
   * allowance.
   */
  removeAll(ownerId: string): Promise<number>;
}

const MAX_SLUG_ATTEMPTS = 6;

export function createDrizzleStore(): SiteStore {
  const ensureAccount = async (ownerId: string): Promise<void> => {
    const db = getDb();
    await db
      .insert(accountEntitlements)
      .values({ ownerId })
      .onConflictDoNothing({ target: accountEntitlements.ownerId });
  };

  const hasAnySite = async (ownerId: string): Promise<boolean> => {
    const db = getDb();
    const [row] = await db
      .select({ slug: sites.slug })
      .from(sites)
      .where(eq(sites.ownerId, ownerId))
      .limit(1);
    return Boolean(row);
  };

  /** Claims the device for an owner, or reports that another owner has it. */
  const claimDevice = async (ownerId: string, deviceHash: string): Promise<boolean> => {
    const db = getDb();
    const inserted = await db
      .insert(deviceClaims)
      .values({ deviceHash, ownerId })
      .onConflictDoNothing({ target: deviceClaims.deviceHash })
      .returning({ ownerId: deviceClaims.ownerId });

    if (inserted.length > 0) return inserted[0]?.ownerId === ownerId;

    const [existing] = await db
      .select({ ownerId: deviceClaims.ownerId })
      .from(deviceClaims)
      .where(eq(deviceClaims.deviceHash, deviceHash))
      .limit(1);

    return existing?.ownerId === ownerId;
  };

  const currentAllowance = async (
    ownerId: string,
    deviceHash: string,
  ): Promise<SiteAllowance> => {
    const db = getDb();
    const [account] = await db
      .select({
        freeSiteUsed: accountEntitlements.freeSiteUsed,
        paidSiteCredits: accountEntitlements.paidSiteCredits,
      })
      .from(accountEntitlements)
      .where(eq(accountEntitlements.ownerId, ownerId))
      .limit(1);

    /*
      The flag is authoritative, but rows from before this table existed have
      no flag. A site is proof enough that the free one was used, and the
      migration backfills the same conclusion.
    */
    const freeUsed = account?.freeSiteUsed === true || (await hasAnySite(ownerId));

    const [claim] = await db
      .select({ ownerId: deviceClaims.ownerId })
      .from(deviceClaims)
      .where(eq(deviceClaims.deviceHash, deviceHash))
      .limit(1);

    return {
      freeAvailable: !freeUsed,
      paidCredits: account?.paidSiteCredits ?? 0,
      deviceAvailable: !claim || claim.ownerId === ownerId,
    };
  };

  const allowanceWithClaim = async (
    ownerId: string,
    deviceHash: string,
  ): Promise<SiteAllowance> => {
    await ensureAccount(ownerId);
    const allowance = await currentAllowance(ownerId, deviceHash);

    /*
      An account that already spent its free site should also claim the device
      it is asking from. Without this, a rollout would leave every existing
      owner's phone unclaimed, and a new email on that phone would still get a
      free site. The claim is the device rule catching up with the account.
    */
    if (!allowance.freeAvailable && allowance.deviceAvailable) {
      await claimDevice(ownerId, deviceHash);
      return currentAllowance(ownerId, deviceHash);
    }

    return allowance;
  };

  const createSite = async (ownerId: string, site: Site): Promise<Site> => {
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
  };

  return {
    async allowance(ownerId, deviceHash) {
      return allowanceWithClaim(ownerId, deviceHash);
    },

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
      return createSite(ownerId, site);
    },

    async createEntitled(ownerId, site, deviceHash) {
      await ensureAccount(ownerId);
      const allowance = await allowanceWithClaim(ownerId, deviceHash);
      const db = getDb();

      if (allowance.freeAvailable && allowance.deviceAvailable) {
        /*
          Claim the device first. Its primary key is the race for two different
          accounts on one phone. Then flip the account flag; its conditional
          update is the race for two tabs on one account. Only when both are
          ours do we write the site.
        */
        if (!(await claimDevice(ownerId, deviceHash))) {
          throw new ApiError(
            402,
            "This phone has already used its free site. Another site is paid.",
            "payment-required",
          );
        }

        const [reserved] = await db
          .update(accountEntitlements)
          .set({ freeSiteUsed: true, updatedAt: new Date() })
          .where(
            and(
              eq(accountEntitlements.ownerId, ownerId),
              eq(accountEntitlements.freeSiteUsed, false),
            ),
          )
          .returning({ ownerId: accountEntitlements.ownerId });

        if (!reserved) {
          throw new ApiError(
            402,
            "Your free site is already used. Another site is paid.",
            "payment-required",
          );
        }

        try {
          return await createSite(ownerId, site);
        } catch (cause) {
          /*
            The site was not written, so the allowance should not be spent.
            Guard with a site check: a failure after the insert (a corrupt read,
            for example) must not hand back a free site that exists.
          */
          if (!(await hasAnySite(ownerId))) {
            await db
              .update(accountEntitlements)
              .set({ freeSiteUsed: false, updatedAt: new Date() })
              .where(
                and(
                  eq(accountEntitlements.ownerId, ownerId),
                  eq(accountEntitlements.freeSiteUsed, true),
                ),
              );
            await db
              .delete(deviceClaims)
              .where(
                and(eq(deviceClaims.deviceHash, deviceHash), eq(deviceClaims.ownerId, ownerId)),
              );
          }
          throw cause;
        }
      }

      if (allowance.paidCredits > 0) {
        const [spent] = await db
          .update(accountEntitlements)
          .set({
            paidSiteCredits: sql`${accountEntitlements.paidSiteCredits} - 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(accountEntitlements.ownerId, ownerId),
              gt(accountEntitlements.paidSiteCredits, 0),
            ),
          )
          .returning({ paidSiteCredits: accountEntitlements.paidSiteCredits });

        if (!spent) {
          throw new ApiError(
            402,
            "No paid site is available. Another site is paid.",
            "payment-required",
          );
        }

        try {
          return await createSite(ownerId, site);
        } catch (cause) {
          // The paid site did not arrive; put the credit back.
          await db
            .update(accountEntitlements)
            .set({
              paidSiteCredits: sql`${accountEntitlements.paidSiteCredits} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(accountEntitlements.ownerId, ownerId));
          throw cause;
        }
      }

      throw new ApiError(
        402,
        allowance.deviceAvailable
          ? "Your free site is already used. Another site is paid."
          : "This phone has already used its free site. Another site is paid.",
        "payment-required",
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

    async removeAll(ownerId) {
      const db = getDb();
      const removed = await db
        .delete(sites)
        .where(eq(sites.ownerId, ownerId))
        .returning({ slug: sites.slug });
      return removed.length;
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
