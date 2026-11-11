import type { Site, SiteStatus } from "./schema";
import { siteSchema } from "./schema";
import { STORAGE_PREFIX } from "./brand";
import { SaveError, type SiteRepository, type SiteSummary } from "./repository";
import { randomSlugSuffix, suffixSlug } from "./slug";
import { parseForStorage, parseStoredSite } from "./parseSite";

/**
 * localStorage-backed implementation, for Step 4a only.
 *
 * Its job is to let the dashboard be built and judged — is the form shape
 * survivable? — without standing up a database first. When the answer is known,
 * Step 4b swaps in Supabase and this stays alive behind a dev flag.
 *
 * Two honest limitations, surfaced in the UI rather than hidden:
 *   - Stored configs are JSON, so it holds text perfectly and bytes not at all.
 *     Uploads are session-only until Cloudinary exists.
 *   - It is per-browser. Clearing site data loses the work.
 */

const CONFIG_PREFIX = `${STORAGE_PREFIX}config:`;
const META_PREFIX = `${STORAGE_PREFIX}meta:`;
const INDEX_KEY = `${STORAGE_PREFIX}index`;

type StoredMeta = {
  updatedAt: string;
};

function hasStorage(): boolean {
  try {
    const probe = `__${STORAGE_PREFIX}probe`;
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    // Private browsing, or a full quota. Either way we cannot persist.
    return false;
  }
}

/**
 * localStorage can be missing (SSR, private mode) or throw on write when the
 * quota is full. Every access goes through here so one failure mode is handled
 * once.
 */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    throw new SaveError(
      "Could not save: this browser's storage is full or unavailable.",
    );
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing useful to do */
  }
}

function readIndex(): string[] {
  const raw = read(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function writeIndex(slugs: string[]): void {
  write(INDEX_KEY, JSON.stringify(slugs));
}

/** Adds a slug to the index, keeping it unique and stable. */
function trackSlug(slug: string): void {
  const index = readIndex();
  if (index.includes(slug)) return;
  writeIndex([...index, slug]);
}

function untrackSlug(slug: string): void {
  writeIndex(readIndex().filter((s) => s !== slug));
}

export class LocalSiteRepository implements SiteRepository {
  readonly kind = "local" as const;

  /** False in private mode or when the quota is already blown. */
  readonly available = hasStorage();

  async list(): Promise<SiteSummary[]> {
    const out: SiteSummary[] = [];

    for (const slug of readIndex()) {
      const raw = read(CONFIG_PREFIX + slug);
      if (!raw) {
        // Index entry with no config — clean it up rather than showing a ghost.
        untrackSlug(slug);
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        untrackSlug(slug);
        continue;
      }

      const result = siteSchema.safeParse(parsed);

      if (result.success) {
        out.push({
          slug,
          status: readStatus(slug),
          name: result.data.identity.name || slug,
          updatedAt: readMeta(slug).updatedAt,
        });
      } else {
        // A config that no longer parses is listed as a broken entry rather
        // than hidden — silently dropping it would look like data loss with no
        // explanation and no way to find it.
        out.push({
          slug,
          status: "draft",
          name: `${slug} (needs fixing)`,
          updatedAt: readMeta(slug).updatedAt,
        });
      }
    }

    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(slug: string): Promise<Site | null> {
    const raw = read(CONFIG_PREFIX + slug);
    if (!raw) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new SaveError(`Saved config for "${slug}" is not valid JSON.`);
    }

    // Validate on read too. A schema change between sessions must not hand a
    // half-compatible object to the renderer.
    return parseStoredSite(parsed, slug);
  }

  /**
   * The public read.
   *
   * A draft is invisible here, exactly as it will be behind row level security.
   * Modelling that locally means the local backend and the real one fail in the
   * same places, so the dashboard's draft/live states can be developed against
   * without the behaviour diverging once Supabase is switched on.
   */
  async getPublic(slug: string): Promise<Site | null> {
    if (readStatus(slug) !== "published") return null;
    return this.get(slug);
  }

  /**
   * Claims a free slug, then writes the first version of the site.
   *
   * The requested slug is tried first. Only if it is taken does this append a
   * random suffix and try again, so the common case keeps the address the
   * author chose. The returned site carries the slug that was actually stored;
   * callers navigate to that, not to the one they asked for.
   */
  async create(site: Site): Promise<Site> {
    const parsed = parseForStorage(site);
    let slug = parsed.slug;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (!read(CONFIG_PREFIX + slug)) {
        const created = { ...parsed, slug };
        this.store(created, "draft");
        return created;
      }
      slug = suffixSlug(parsed.slug, randomSlugSuffix());
    }

    throw new SaveError("Could not find a free web address. Try a different name.");
  }

  /**
   * Updates a site that already exists.
   *
   * Never creates. An autosave that arrives after a deletion must not bring the
   * site back, and a typo in a URL must not silently make a new draft.
   */
  async save(site: Site): Promise<void> {
    const parsed = parseForStorage(site);

    if (!read(CONFIG_PREFIX + parsed.slug)) {
      throw new SaveError(
        `There is no saved site called "${parsed.slug}".`,
        undefined,
        "not-found",
      );
    }

    this.store(parsed, readStatus(parsed.slug));
  }

  /** The one place a config, its timestamp, status and index entry are written. */
  private store(site: Site, status: SiteStatus): void {
    write(CONFIG_PREFIX + site.slug, JSON.stringify(site));
    write(
      META_PREFIX + site.slug,
      JSON.stringify({ updatedAt: new Date().toISOString() } satisfies StoredMeta),
    );
    writeStatus(site.slug, status);
    trackSlug(site.slug);
  }

  /**
   * Publishes, or takes a site back down.
   *
   * Refuses on a slug with no config. That is not defensive padding: the status
   * key would otherwise exist independently of the config it describes, so
   * `getPublic` could find a "published" for a site that was deleted — an orphan
   * flag that makes the site look live in a list while every link 404s.
   */
  async setStatus(slug: string, status: SiteStatus): Promise<void> {
    if (!read(CONFIG_PREFIX + slug)) {
      throw new SaveError(`There is no saved site called "${slug}" to publish.`);
    }
    writeStatus(slug, status);
  }

  async remove(slug: string): Promise<void> {
    remove(CONFIG_PREFIX + slug);
    removeStatus(slug);
    remove(META_PREFIX + slug);
    untrackSlug(slug);
  }
}

const STATUS_PREFIX = `${STORAGE_PREFIX}status:`;

function readStatus(slug: string): SiteStatus {
  const raw = read(STATUS_PREFIX + slug);
  return raw === "published" || raw === "submitted" ? raw : "draft";
}

function writeStatus(slug: string, status: SiteStatus): void {
  write(STATUS_PREFIX + slug, status);
}

function removeStatus(slug: string): void {
  remove(STATUS_PREFIX + slug);
}

function readMeta(slug: string): StoredMeta {
  const raw = read(META_PREFIX + slug);
  if (!raw) return { updatedAt: "" };
  try {
    const parsed = JSON.parse(raw) as Partial<StoredMeta>;
    return { updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "" };
  } catch {
    return { updatedAt: "" };
  }
}