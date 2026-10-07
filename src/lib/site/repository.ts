import type { Site, SiteStatus } from "./schema";

/**
 * Storage, abstracted.
 *
 * `LocalSiteRepository` implements it today. A hosted backend implements the
 * same interface, and nothing above this line changes — the form, the autosave,
 * the preview. That seam is the whole reason prototyping the form against
 * localStorage was cheap rather than wasteful.
 */

/** Just enough about a site to list it, without shipping its whole config. */
export type SiteSummary = {
  slug: string;
  status: SiteStatus;
  /** Site name, for display. Falls back to the slug. */
  name: string;
  /** ISO timestamp of the last save. */
  updatedAt: string;
};

export interface SiteRepository {
  /** Which backend is live, so the UI can say so out loud. */
  readonly kind: "local" | "remote";

  list(): Promise<SiteSummary[]>;
  /**
   * Reads a site as its owner.
   *
   * Returns any status — draft, submitted or published. This is the dashboard's
   * read, and it is deliberately different from `getPublic`.
   */
  get(slug: string): Promise<Site | null>;

  /**
   * Reads a site the way a visitor would: no credentials, published only.
   *
   * Returns null for a draft, which is the correct answer rather than an error —
   * from out here, an unpublished site does not exist. On a hosted backend
   * this is enforced by row level security, not by the filter in the query, so
   * forgetting the filter cannot leak anything.
   */
  /**
   * The visitor's read.
   *
   * Returns null for a draft, which is the correct answer rather than an error —
   * from out here, an unpublished site does not exist. It is also the *only* place
   * publication is decided: a caller that has a site from this method knows it is
   * live, so nothing else needs to ask about status a second time. That is not a
   * micro-optimisation; asking twice used to cost a whole extra query whose answer
   * could only ever be "published".
   */
  getPublic(slug: string): Promise<Site | null>;

  /**
   * Creates or replaces a site, as its owner.
   *
   * Implementations must not silently accept an invalid config — parse it, and
   * reject with a useful message. A half-written config in the database is a
   * blank page for the person you built it for.
   */
  save(site: Site): Promise<void>;

  remove(slug: string): Promise<void>;

  /**
   * Changes whether the public link works.
   *
   * Separate from `save` on purpose. Status is the one thing in the config that
   * must not be editable from the form: `save` takes a whole `Site` and parses it,
   * and folding publication into that would mean every autosave could quietly flip
   * a live site back to a draft — or, worse, a draft live.
   *
   * It is also the only call that is allowed to leave the "everything that
   * matters is filled in" state. Nothing about writing "published" should depend
   * on the text being complete; publishing a half-finished site is a choice
   * somebody makes, and `findIssues` exists to tell them what they are choosing.
   */
  setStatus(slug: string, status: SiteStatus): Promise<void>;

  /**
   * How a save failed in a way the author can act on.
   *
   * A slug already taken is the common case, and it deserves its own field so
   * the create form can say "that name is already in use" rather than dumping
   * a Postgres constraint message at someone making a birthday present.
   */
  lastError?: { code?: string } | undefined;
}

/** Thrown when a save fails, carrying something worth showing a human. */
export class SaveError extends Error {
  constructor(
    message: string,
    readonly path?: string | undefined,
    readonly code?: string | undefined,
  ) {
    super(message);
    this.name = "SaveError";
  }
}

/** True when the failure was "that slug is already taken". */
export function isSlugTaken(error: unknown): boolean {
  if (error instanceof SaveError) return error.code === "slug-taken";
  return false;
}