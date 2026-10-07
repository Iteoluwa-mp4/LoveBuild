import { LocalSiteRepository } from "./localRepository";
import type { SiteRepository } from "./repository";
import { getSupabaseRepository } from "./supabaseRepository";
import { isSupabaseConfigured } from "../supabase";

/**
 * Chooses a backend.
 *
 * Supabase when the project is configured, localStorage otherwise. That fallback
 * is deliberate: the app runs with no `.env` at all, so the dashboard can be
 * developed and demoed offline, and so a missing key produces a working app
 * rather than a blank screen.
 *
 * One instance of each, created lazily: a new repository on every render would be a new
 * be a new object identity and the autosave effect would re-subscribe each time.
 */

let chosen: SiteRepository | null = null;

export function getRepository(): SiteRepository {
  chosen ??= isSupabaseConfigured ? getSupabaseRepository() : new LocalSiteRepository();

  return chosen;
}

/** Which backend is live, for showing in the UI. */
export function repositoryKind(): "local" | "remote" {
  return getRepository().kind;
}