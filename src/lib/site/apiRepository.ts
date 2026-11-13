import { getFirebaseAuth } from "./firebase";
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
const API_ROOT = "/api";

export class ApiSiteRepository implements SiteRepository {
  readonly kind = "remote" as const;

  async list(): Promise<SiteSummary[]> {
    const data = await request<{ sites: SiteSummary[] }>("/sites");
    return data.sites;
  }

  async get(slug: string): Promise<Site | null> {
    try {
      const data = await request<{ site: Site }>(`/sites/${encodeURIComponent(slug)}`);
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
    let response: Response;
    try {
      response = await fetch(`${API_ROOT}/public/sites/${encodeURIComponent(slug)}`);
    } catch {
      throw new SaveError(
        "Could not reach storage. Check your connection and try again.",
        undefined,
        "unavailable",
      );
    }

    if (response.status === 404) return null;
    if (!response.ok) throw await errorFor(response);

    const data = (await response.json()) as { site: Site };
    return data.site;
  }

  async create(site: Site): Promise<Site> {
    const parsed = parseForStorage(site);
    const data = await request<{ site: Site }>("/sites", {
      method: "POST",
      body: JSON.stringify(parsed),
    });
    return data.site;
  }

  async save(site: Site): Promise<void> {
    const parsed = parseForStorage(site);
    await request<{ ok: true }>(`/sites/${encodeURIComponent(parsed.slug)}`, {
      method: "PUT",
      body: JSON.stringify(parsed),
    });
  }

  async setStatus(slug: string, status: SiteStatus): Promise<void> {
    await request<{ ok: true }>(`/sites/${encodeURIComponent(slug)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  async remove(slug: string): Promise<void> {
    await request<void>(`/sites/${encodeURIComponent(slug)}`, { method: "DELETE" });
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = getFirebaseAuth()?.currentUser;
  if (!user) throw new SaveError("Sign in to open your sites.");

  let token: string;
  try {
    token = await user.getIdToken();
  } catch {
    throw new SaveError(
      "Your session has expired. Sign in again.",
      undefined,
      "unauthorized",
    );
  }

  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, { ...init, headers });
  } catch {
    throw new SaveError(
      "Could not reach storage. Check your connection and try again.",
      undefined,
      "unavailable",
    );
  }

  if (!response.ok) throw await errorFor(response);
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

/**
 * Turns an API failure into the same `SaveError` the repository contract has
 * always used, so every existing catch site keeps working.
 */
async function errorFor(response: Response): Promise<SaveError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    /* A proxy or a crash can return HTML. Fall back to a sentence. */
  }

  const data =
    typeof body === "object" && body !== null
      ? (body as { error?: unknown; code?: unknown; path?: unknown })
      : {};

  const message =
    typeof data.error === "string"
      ? data.error
      : response.status === 401
        ? "Your session has expired. Sign in again."
        : "Could not reach storage. Try again.";

  return new SaveError(
    message,
    typeof data.path === "string" ? data.path : undefined,
    typeof data.code === "string" ? data.code : undefined,
  );
}
