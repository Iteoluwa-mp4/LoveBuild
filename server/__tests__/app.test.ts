import { beforeEach, describe, expect, it } from "vitest";

import { emptySite } from "../../src/lib/site/default";
import type { SiteSummary } from "../../src/lib/site/repository";
import type { Site, SiteStatus } from "../../src/lib/site/schema";
import { createApp } from "../app";
import { ApiError } from "../errors";
import type { SiteStore } from "../store";

/**
 * Route tests with no database.
 *
 * The store is the same interface the Drizzle implementation satisfies, so these
 * tests pin the HTTP contract — auth, ownership, validation, public visibility —
 * while the SQL itself stays a thin translation of the same operations.
 */

type Row = {
  ownerId: string;
  status: SiteStatus;
  site: Site;
  updatedAt: Date;
};

class MemoryStore implements SiteStore {
  readonly rows = new Map<string, Row>();

  async list(ownerId: string): Promise<SiteSummary[]> {
    return [...this.rows.entries()]
      .filter(([, row]) => row.ownerId === ownerId)
      .map(([slug, row]) => ({
        slug,
        status: row.status,
        name: row.site.identity.name || slug,
        updatedAt: row.updatedAt.toISOString(),
      }));
  }

  async get(ownerId: string, slug: string): Promise<Site | null> {
    const row = this.rows.get(slug);
    return row?.ownerId === ownerId ? row.site : null;
  }

  async getPublic(slug: string): Promise<Site | null> {
    const row = this.rows.get(slug);
    return row?.status === "published" ? row.site : null;
  }

  async create(ownerId: string, site: Site): Promise<Site> {
    this.rows.set(site.slug, {
      ownerId,
      status: "draft",
      site,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    return site;
  }

  async save(ownerId: string, site: Site): Promise<void> {
    const row = this.rows.get(site.slug);
    if (!row || row.ownerId !== ownerId) {
      throw new ApiError(404, "This site no longer exists.", "not-found");
    }
    row.site = site;
    row.updatedAt = new Date("2026-01-02T00:00:00.000Z");
  }

  async setStatus(ownerId: string, slug: string, status: SiteStatus): Promise<void> {
    const row = this.rows.get(slug);
    if (!row || row.ownerId !== ownerId) {
      throw new ApiError(404, `There is no saved site called "${slug}".`, "not-found");
    }
    row.status = status;
  }

  async remove(ownerId: string, slug: string): Promise<void> {
    const row = this.rows.get(slug);
    if (row?.ownerId === ownerId) this.rows.delete(slug);
  }
}

describe("api", () => {
  let store: MemoryStore;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    store = new MemoryStore();
    app = createApp({
      store,
      verifyToken: async (token) => {
        if (token === "alice") return "user-alice";
        if (token === "bob") return "user-bob";
        throw new Error("bad token");
      },
    });
  });

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  it("answers a health check", async () => {
    const response = await app.request("/api/health");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("refuses an owner route without a token", async () => {
    const response = await app.request("/api/sites");
    expect(response.status).toBe(401);
  });

  it("refuses an invalid token", async () => {
    const response = await app.request("/api/sites", { headers: auth("nobody") });
    expect(response.status).toBe(401);
  });

  it("creates a site for the signed-in owner and lists it", async () => {
    const site = emptySite("for-sarah");

    const created = await app.request("/api/sites", {
      method: "POST",
      headers: { ...auth("alice"), "content-type": "application/json" },
      body: JSON.stringify(site),
    });

    expect(created.status).toBe(201);
    const createdBody = (await created.json()) as { site: Site };
    expect(createdBody.site.slug).toBe("for-sarah");
    expect(store.rows.get("for-sarah")?.ownerId).toBe("user-alice");

    const listed = await app.request("/api/sites", { headers: auth("alice") });
    expect(listed.status).toBe(200);
    const listBody = (await listed.json()) as { sites: SiteSummary[] };
    expect(listBody.sites).toEqual([
      {
        slug: "for-sarah",
        status: "draft",
        name: "for-sarah",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("keeps one owner's site out of another owner's dashboard", async () => {
    const site = emptySite("hers");
    await store.create("user-alice", site);

    const alice = await app.request("/api/sites/hers", { headers: auth("alice") });
    expect(alice.status).toBe(200);

    const bob = await app.request("/api/sites/hers", { headers: auth("bob") });
    expect(bob.status).toBe(404);
  });

  it("only serves a published site to the public", async () => {
    const site = emptySite("hers");
    await store.create("user-alice", site);

    const draft = await app.request("/api/public/sites/hers");
    expect(draft.status).toBe(404);

    await store.setStatus("user-alice", "hers", "published");
    const live = await app.request("/api/public/sites/hers");
    expect(live.status).toBe(200);
    const body = (await live.json()) as { site: Site };
    expect(body.site.slug).toBe("hers");
  });

  it("saves only the owner's site and refuses to change its address", async () => {
    const site = emptySite("hers");
    await store.create("user-alice", site);

    const changed = { ...site, identity: { name: "For her" } };
    const saved = await app.request("/api/sites/hers", {
      method: "PUT",
      headers: { ...auth("alice"), "content-type": "application/json" },
      body: JSON.stringify(changed),
    });
    expect(saved.status).toBe(200);
    expect(store.rows.get("hers")?.site.identity.name).toBe("For her");

    const moved = await app.request("/api/sites/hers", {
      method: "PUT",
      headers: { ...auth("alice"), "content-type": "application/json" },
      body: JSON.stringify({ ...changed, slug: "somewhere-else" }),
    });
    expect(moved.status).toBe(400);

    const bob = await app.request("/api/sites/hers", {
      method: "PUT",
      headers: { ...auth("bob"), "content-type": "application/json" },
      body: JSON.stringify(changed),
    });
    expect(bob.status).toBe(404);
  });

  it("publishes and unpublishes through the status route", async () => {
    await store.create("user-alice", emptySite("hers"));

    const publish = await app.request("/api/sites/hers/status", {
      method: "PATCH",
      headers: { ...auth("alice"), "content-type": "application/json" },
      body: JSON.stringify({ status: "published" }),
    });
    expect(publish.status).toBe(200);
    expect(store.rows.get("hers")?.status).toBe("published");

    const invalid = await app.request("/api/sites/hers/status", {
      method: "PATCH",
      headers: { ...auth("alice"), "content-type": "application/json" },
      body: JSON.stringify({ status: "live" }),
    });
    expect(invalid.status).toBe(400);
  });

  it("deletes only the owner's site", async () => {
    await store.create("user-alice", emptySite("hers"));

    const bob = await app.request("/api/sites/hers", {
      method: "DELETE",
      headers: auth("bob"),
    });
    expect(bob.status).toBe(204);
    expect(store.rows.has("hers")).toBe(true);

    const alice = await app.request("/api/sites/hers", {
      method: "DELETE",
      headers: auth("alice"),
    });
    expect(alice.status).toBe(204);
    expect(store.rows.has("hers")).toBe(false);
  });

  it("reports the invalid field instead of storing a broken config", async () => {
    const response = await app.request("/api/sites", {
      method: "POST",
      headers: { ...auth("alice"), "content-type": "application/json" },
      body: JSON.stringify({ ...emptySite("for-sarah"), slug: "" }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { code?: string; path?: string };
    expect(body.code).toBe("invalid-config");
    expect(body.path).toBe("slug");
  });
});
