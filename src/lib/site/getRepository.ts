import { ApiSiteRepository } from "./apiRepository";
import { isFirebaseConfigured } from "./firebase";
import { LocalSiteRepository } from "./localRepository";
import type { SiteRepository } from "./repository";

/**
 * Chooses a backend.
 *
 * With Firebase configured, sites live in Neon and are reached through the
 * same-origin `/api` route. A fresh clone with no `.env.local` still runs in
 * development, with sites in localStorage and no login — that is the
 * development path, not a second product. A production build without Firebase
 * fails closed at the auth gate.
 *
 * The choice is deliberately not made per user. Public pages must read even
 * when nobody is signed in, and a repository that switched implementation on
 * sign-out would make the same link work and then stop working. The API handles
 * both cases: owner routes require a verified Firebase token, and the one
 * public route only ever returns a published site.
 */
let chosen: SiteRepository | null = null;

export function getRepository(): SiteRepository {
  chosen ??= isFirebaseConfigured()
    ? new ApiSiteRepository()
    : new LocalSiteRepository();
  return chosen;
}

/** Which backend is live, for showing in the UI. */
export function repositoryKind(): "local" | "remote" {
  return getRepository().kind;
}
