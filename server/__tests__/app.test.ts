import { beforeEach, describe, expect, it } from "vitest";

import { emptySite } from "../../src/lib/site/default";
import type { SiteAllowance } from "../../src/lib/site/entitlement";
import type { SiteSummary } from "../../src/lib/site/repository";
import type { Site, SiteStatus } from "../../src/lib/site/schema";
import { createApp } from "../app";
import { ApiError } from "../errors";
import type { MediaSigner } from "../mediaSigner";
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
  readonly accounts = new Map<string, { freeSiteUsed: boolean; paidSiteCredits: number }>();
  readonly devices = new Map<string, string>();

  private account(ownerId: string) {
    let account = this.accounts.get(ownerId);
    if (!account) {
      account = { freeSiteUsed: false, paidSiteCredits: 0 };
      this.accounts.set(ownerId, account);
    }
    return account;
  }

  async allowance(ownerId: string, deviceHash: string): Promise<SiteAllowance> {
    const account = this.account(ownerId);
    const hasSite = [...this.rows.values()].some((row) => row.ownerId === ownerId);
    const freeUsed = account.freeSiteUsed || hasSite;
    const claimedBy = this.devices.get(deviceHash);

    // Mirror the Drizzle store's rollout behaviour: an account that already
    // spent its free site claims the device it is asking from.
    if (freeUsed && claimedBy === undefined) {
      this.devices.set(deviceHash, ownerId);
    }

    const owner = this.devices.get(deviceHash);
    return {
      freeAvailable: !freeUsed,
      paidCredits: account.paidSiteCredits,
      deviceAvailable: owner === undefined || owner === ownerId,
    };
  }

  async createEntitled(ownerId: string, site: Site, deviceHash: string): Promise<Site> {
    const allowance = await this.allowance(ownerId, deviceHash);

    if (allowance.freeAvailable && allowance.deviceAvailable) {
      this.devices.set(deviceHash, ownerId);
      this.account(ownerId).freeSiteUsed = true;
      return this.create(ownerId, site);
    }

    if (allowance.paidCredits > 0) {
      this.account(ownerId).paidSiteCredits -= 1;
      return this.create(ownerId, site);
    }

    throw new ApiError(
      402,
      allowance.deviceAvailable
        ? "Your free site is already used. Another site is paid."
        : "This phone has already used its free site. Another site is paid.",
      "payment-required",
    );
  }

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

  async removeAll(ownerId: string): Promise<number> {
    const doomed = [...this.rows.entries()].filter(([, row]) => row.ownerId === ownerId);
    for (const [slug] of doomed) this.rows.delete(slug);
    return doomed.length;
  }
}

describe("api", () => {
  let store: MemoryStore;
  let app: ReturnType<typeof createApp>;
  let media: MediaSigner;

  beforeEach(() => {
    store = new MemoryStore();
    media = {
      configured: true,
      signUpload: async (kind) => ({
        apiKey: "public-key",
        uploadUrl: `https://api.cloudinary.com/v1_1/demo-cloud/${kind}/upload`,
        timestamp: 1_700_000_000,
        publicId: "lovebuilds/abc",
        type: "authenticated",
        signature: "upload-signature",
      }),
      signDelivery: async (kind, publicId, format) =>
        `https://res.cloudinary.com/demo-cloud/${kind}/authenticated/s--sig--/${publicId}.${format}`,
    };
    app = createApp({
      store,
      media,
      verifyToken: async (token) => {
        if (token === "alice") return "user-alice";
        if (token === "bob") return "user-bob";
        throw new Error("bad token");
      },
    });
  });

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const device = (id: string) => ({ cookie: `lovebuilds_device=${id}` });
  const DEVICE_A = "device-aaaaaaaaaaaaaaaa";
  const DEVICE_B = "device-bbbbbbbbbbbbbbbb";

  const create = (token: string, slug: string, deviceId: string) =>
    app.request("/api/sites", {
      method: "POST",
      headers: {
        ...auth(token),
        ...device(deviceId),
        "content-type": "application/json",
      },
      body: JSON.stringify(emptySite(slug)),
    });

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

  it("refuses to sign media without a token", async () => {
    const upload = await app.request("/api/media/sign-upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "image" }),
    });
    expect(upload.status).toBe(401);

    const delivery = await app.request("/api/media/sign-delivery", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "image", publicId: "lovebuilds/abc", format: "jpg" }),
    });
    expect(delivery.status).toBe(401);
  });

  it("issues a signed upload to a signed-in owner", async () => {
    const response = await app.request("/api/media/sign-upload", {
      method: "POST",
      headers: { ...auth("alice"), "content-type": "application/json" },
      body: JSON.stringify({ kind: "video" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      apiKey: "public-key",
      uploadUrl: "https://api.cloudinary.com/v1_1/demo-cloud/video/upload",
      timestamp: 1_700_000_000,
      publicId: "lovebuilds/abc",
      type: "authenticated",
      signature: "upload-signature",
    });
  });

  it("signs a delivery URL only for assets this app created", async () => {
    const signed = await app.request("/api/media/sign-delivery", {
      method: "POST",
      headers: { ...auth("alice"), "content-type": "application/json" },
      body: JSON.stringify({ kind: "image", publicId: "lovebuilds/abc", format: "jpg" }),
    });
    expect(signed.status).toBe(200);
    await expect(signed.json()).resolves.toEqual({
      url: "https://res.cloudinary.com/demo-cloud/image/authenticated/s--sig--/lovebuilds/abc.jpg",
    });

    const outside = await app.request("/api/media/sign-delivery", {
      method: "POST",
      headers: { ...auth("alice"), "content-type": "application/json" },
      body: JSON.stringify({ kind: "image", publicId: "someone-else/asset", format: "jpg" }),
    });
    expect(outside.status).toBe(400);
    const body = (await outside.json()) as { code?: string; path?: string };
    expect(body.code).toBe("invalid-media");
    expect(body.path).toBe("publicId");
  });

  it("rejects a malformed media request instead of signing it", async () => {
    const response = await app.request("/api/media/sign-upload", {
      method: "POST",
      headers: { ...auth("alice"), "content-type": "application/json" },
      body: JSON.stringify({ kind: "audio" }),
    });
    expect(response.status).toBe(400);
  });

  it("says media is unavailable when the server has no Cloudinary settings", async () => {
    const unconfigured = createApp({
      store,
      media: {
        configured: false,
        signUpload: async () => {
          throw new Error("should not be called");
        },
        signDelivery: async () => {
          throw new Error("should not be called");
        },
      },
      verifyToken: async () => "user-alice",
    });

    const response = await unconfigured.request("/api/media/sign-upload", {
      method: "POST",
      headers: { ...auth("alice"), "content-type": "application/json" },
      body: JSON.stringify({ kind: "image" }),
    });
    expect(response.status).toBe(503);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("media-unconfigured");
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

  it("issues a durable device cookie when a site is created", async () => {
    const response = await app.request("/api/sites", {
      method: "POST",
      headers: { ...auth("alice"), "content-type": "application/json" },
      body: JSON.stringify(emptySite("first")),
    });

    expect(response.status).toBe(201);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("lovebuilds_device=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/api");
  });

  it("accepts the browser install id as the first device identity", async () => {
    const response = await app.request("/api/sites", {
      method: "POST",
      headers: {
        ...auth("alice"),
        "x-lovebuilds-device": DEVICE_A,
        "content-type": "application/json",
      },
      body: JSON.stringify(emptySite("first")),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toContain(`lovebuilds_device=${DEVICE_A}`);
  });

  it("allows as many sites as the account wants while creation is free", async () => {
    expect((await create("alice", "first", DEVICE_A)).status).toBe(201);
    expect((await create("alice", "second", DEVICE_A)).status).toBe(201);
    expect((await create("alice", "third", DEVICE_B)).status).toBe(201);

    expect([...store.rows.keys()]).toEqual(["first", "second", "third"]);
  });

  it("allows another account on the same device while creation is free", async () => {
    expect((await create("alice", "first", DEVICE_A)).status).toBe(201);
    expect((await create("bob", "bobs", DEVICE_A)).status).toBe(201);

    expect(store.rows.get("bobs")?.ownerId).toBe("user-bob");
  });

  it("reports a free allowance to a dashboard from the previous release", async () => {
    const response = await app.request("/api/entitlement", {
      headers: { ...auth("alice"), ...device(DEVICE_A) },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      allowance: {
        freeAvailable: true,
        paidCredits: 0,
        deviceAvailable: true,
      },
    });
  });

  it("allows another site after one is deleted", async () => {
    expect((await create("alice", "first", DEVICE_A)).status).toBe(201);

    const removed = await app.request("/api/sites/first", {
      method: "DELETE",
      headers: auth("alice"),
    });
    expect(removed.status).toBe(204);

    const again = await create("alice", "another", DEVICE_A);
    expect(again.status).toBe(201);
    expect(store.rows.has("another")).toBe(true);
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

  it("refuses to wipe an account without a token", async () => {
    const response = await app.request("/api/account", { method: "DELETE" });
    expect(response.status).toBe(401);

    const invalid = await app.request("/api/account", {
      method: "DELETE",
      headers: auth("nobody"),
    });
    expect(invalid.status).toBe(401);
    expect(store.rows.size).toBe(0);
  });

  it("wipes every site the caller owns and leaves other accounts alone", async () => {
    await store.create("user-alice", emptySite("first"));
    await store.create("user-alice", emptySite("second"));
    await store.create("user-bob", emptySite("theirs"));

    const response = await app.request("/api/account", {
      method: "DELETE",
      headers: auth("alice"),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, removed: 2 });
    expect(store.rows.has("first")).toBe(false);
    expect(store.rows.has("second")).toBe(false);
    expect(store.rows.has("theirs")).toBe(true);
  });

  it("answers a second wipe the same way, so a retry after a failure is safe", async () => {
    await store.create("user-alice", emptySite("only"));

    const first = await app.request("/api/account", {
      method: "DELETE",
      headers: auth("alice"),
    });
    await expect(first.json()).resolves.toEqual({ ok: true, removed: 1 });

    const again = await app.request("/api/account", {
      method: "DELETE",
      headers: auth("alice"),
    });
    expect(again.status).toBe(200);
    await expect(again.json()).resolves.toEqual({ ok: true, removed: 0 });
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
