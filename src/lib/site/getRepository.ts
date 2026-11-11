import { isFirebaseConfigured } from "./firebase";
import { FirestoreSiteRepository } from "./firestoreRepository";
import { LocalSiteRepository } from "./localRepository";
import type { SiteRepository } from "./repository";

/**
 * Chooses a backend.
 *
 * When Firebase is configured, sites live in Firestore and follow the account.
 * A fresh clone with no `.env.local` still runs, with sites in localStorage and
 * no login — that is the development path, not a second product.
 *
 * The choice is deliberately not made per user. Public pages must read even
 * when nobody is signed in, and a repository that switched implementation on
 * sign-out would make the same link work and then stop working. The hosted
 * implementation handles both cases: Firestore's rules decide who can read
 * which document, and the owner-only methods ask Auth for the current uid.
 */
let chosen: SiteRepository | null = null;

export function getRepository(): SiteRepository {
  chosen ??= isFirebaseConfigured()
    ? new FirestoreSiteRepository()
    : new LocalSiteRepository();
  return chosen;
}

/** Which backend is live, for showing in the UI. */
export function repositoryKind(): "local" | "remote" {
  return getRepository().kind;
}
