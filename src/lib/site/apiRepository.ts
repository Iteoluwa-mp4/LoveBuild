import { apiRequest, publicRequest } from "./apiClient";
import { parseForStorage } from "./parseSite";
import { SaveError, type SiteRepository, type SiteSummary } from "./repository";
import type { Site, SiteStatus } from "./schema";

/**
 * The hosted backend, over the same-origin `/api` route.
 *
 * The browser never sees a database credential. Every request carries the
 * current Firebase ID token, and the API verifies it against Google's public
 * keys before it touches Neon. Public site reads are the one unauthenticated
 * operation; the server decides whether a draft is visible.
 *
 * The repository contract is unchanged, which is the point: the dashboard,
 * autosave and create form did not need to learn that storage moved.
 */
export class ApiSiteRepository implements SiteRepository {
  readonly kind = "remote" as const;

  async list(): Promise<SiteSummary[]> {
    const data = await apiRequest<{ sites: SiteSummary[] }>("/sites");
    return data.sites;
  }

  async get(slug: string): Promise<Site | null> {
    try {
      const data = await apiRequest<{ site: Site }>(`/sites/${encodeURIComponent(slug)}`);
      return data.site;
    } catch (cause) {
      if (cause instanceof SaveError && cause.code === "not-found") return null;
      throw cause;
    }
  }

  /**
   * No credentials. This is the visitor's read, so it must work signed out and
   * on a page that has not loaded the dashboard.
   */
  async getPublic(slug: string): Promise<Site | null> {
    try {
      const data = await publicRequest<{ site: Site }>(
        `/public/sites/${encodeURIComponent(slug)}`,
      );
      return data.site;
    } catch (cause) {
      if (cause instanceof SaveError && cause.code === "not-found") return null;
      throw cause;
    }
  }

  async create(site: Site): Promise<Site> {
    const parsed = parseForStorage(site);
    const data = await apiRequest<{ site: Site }>("/sites", {
      method: "POST",
      body: JSON.stringify(parsed),
    });
    return data.site;
  }

  async save(site: Site): Promise<void> {
    const parsed = parseForStorage(site);
    await apiRequest<{ ok: true }>(`/sites/${encodeURIComponent(parsed.slug)}`, {
      method: "PUT",
      body: JSON.stringify(parsed),
    });
  }

  async setStatus(slug: string, status: SiteStatus): Promise<void> {
    await apiRequest<{ ok: true }>(`/sites/${encodeURIComponent(slug)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  async remove(slug: string): Promise<void> {
    await apiRequest<void>(`/sites/${encodeURIComponent(slug)}`, { method: "DELETE" });
  }
}
