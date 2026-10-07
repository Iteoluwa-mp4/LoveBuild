import type { Site, SiteStatus } from "./schema";
import { siteSchema } from "./schema";
import { STORAGE_PREFIX } from "./brand";
import { SaveError, type SiteRepository, type SiteSummary } from "./repository";

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
    const result = siteSchema.safeParse(parsed);
    if (!result.success) {
      const first = result.error.issues[0];
      throw new SaveError(
        `Saved config for "${slug}" no longer matches the current schema` +
          (first ? ` (at ${first.path.join(".")})` : "") + ".",
        first?.path.join("."),
      );
    }

    return result.data;
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
   * Refuses a second site with the same slug.
   *
   * Postgres would reject this on a unique index; localStorage would not, and the
   * two sites would silently overwrite each other. Failing here keeps the
   * create-site form honest while developing offline.
   */
  private async assertSlugFree(slug: string): Promise<void> {
    const existing = readIndex().filter((s) => s !== slug);
    if (existing.includes(slug)) {
      throw new SaveError(`"${slug}" is already in use.`, undefined, "slug-taken");
    }
  }

  async save(site: Site): Promise<void> {
    await this.assertSlugFree(site.slug);
    // Parse before storing. Storing a config the schema rejects means the next
    // read throws, which is far harder to diagnose than refusing the write.
    const result = siteSchema.safeParse(site);
    if (!result.success) {
      const first = result.error.issues[0];
      throw new SaveError(
        `Not saved: ${first?.message ?? "the config is invalid"}` +
          (first?.path.length ? ` at ${first.path.join(".")}` : "") + ".",
        first?.path.join("."),
      );
    }

    const payload = JSON.stringify(result.data);
    write(CONFIG_PREFIX + site.slug, payload);
    write(META_PREFIX + site.slug, JSON.stringify({ updatedAt: new Date().toISOString() } satisfies StoredMeta));
    writeStatus(site.slug, readStatus(site.slug));
    trackSlug(site.slug);
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
  if (!raw) return { updatedAt: new Date(0).toISOString() };
  try {
    const parsed = JSON.parse(raw) as Partial<StoredMeta>;
    return { updatedAt: parsed.updatedAt ?? new Date(0).toISOString() };
  } catch {
    return { updatedAt: new Date(0).toISOString() };
  }
}