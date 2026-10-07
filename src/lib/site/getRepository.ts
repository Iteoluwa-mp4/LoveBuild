import { LocalSiteRepository } from "./localRepository";
import type { SiteRepository } from "./repository";

/**
 * Chooses a backend.
 *
 * Local storage is currently the only implementation, and it is meant to stay the
 * fallback forever rather than being replaced. Every backend this app will ever
 * have is one someone opens in *their own browser* to edit *their own* site, so
 * "works with nothing configured" is not a prototype compromise — it is the
 * behaviour.
 *
 * The seam is still here, and still worth its weight: a hosted backend drops in as
 * one more `SiteRepository` and nothing above this line changes. That was the
 * whole reason the interface was drawn before anything was decided about hosting.
 */

/** One instance, so the React tree does not remount on every render. */
let chosen: SiteRepository | null = null;

export function getRepository(): SiteRepository {
  chosen ??= new LocalSiteRepository();
  return chosen;
}

/** Which backend is live, for showing in the UI. */
export function repositoryKind(): "local" | "remote" {
  return getRepository().kind;
}