import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { getFirebaseAuth, getFirebaseDb } from "./firebase";
import { parseForStorage, parseStoredSite } from "./parseSite";
import { SaveError, type SiteRepository, type SiteSummary } from "./repository";
import type { Site, SiteStatus } from "./schema";
import { randomSlugSuffix, suffixSlug } from "./slug";

/**
 * Firestore, as the hosted implementation of `SiteRepository`.
 *
 * One document per site, keyed by slug:
 *
 *   sites/{slug}
 *     ownerId:       the Firebase uid that created it
 *     slug:          duplicated from the id so rules can prove it never changes
 *     status:        draft | submitted | published
 *     schemaVersion: the config's `version`, for migrations
 *     name:          denormalised for the shelf, so listing stays cheap
 *     site:          the whole validated config
 *     createdAt / updatedAt: server timestamps
 *
 * The document id is the slug is the public URL. That is deliberate: a link
 * that works is the product, and a separate opaque id would mean a lookup round
 * trip before the page could even start.
 *
 * ## Who can read what
 *
 * Enforced in `firestore.rules`, not here. A published document is public; a
 * draft is readable only by its owner. A signed-out read of a draft is a
 * permission denial, which `getPublic` turns into `null` — from outside, the
 * site does not exist, which is the honest answer.
 *
 * ## Why owner methods are not cached
 *
 * The repository is a singleton, but the signed-in user is not. Every owner
 * operation asks Firebase Auth for the current user, so signing out cannot
 * leave the previous account's uid frozen into a cached instance.
 */

/** Six attempts: the requested slug, then five random suffixes. */
const MAX_SLUG_ATTEMPTS = 6;

export class FirestoreSiteRepository implements SiteRepository {
  readonly kind = "remote" as const;

  async list(): Promise<SiteSummary[]> {
    const { db, uid } = requireOwner();

    try {
      // No orderBy: a single-field filter needs no composite index, and the
      // list is small enough to sort here. Adding orderBy("updatedAt") would
      // require an index the project does not have yet, turning the shelf into
      // a setup error on first login.
      const snapshot = await getDocs(
        query(collection(db, "sites"), where("ownerId", "==", uid)),
      );

      return snapshot.docs
        .map(summaryOf)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    } catch (cause) {
      throw saveFailure(cause, "Could not load your sites.");
    }
  }

  async get(slug: string): Promise<Site | null> {
    const { db, uid } = requireOwner();

    try {
      const snapshot = await getDoc(doc(db, "sites", slug));
      if (!snapshot.exists()) return null;

      const data = snapshot.data();
      // A published site is readable by anyone, but the editor is the owner's.
      // Returning somebody else's site here would show it as editable and then
      // fail on every save.
      if (data.ownerId !== uid) return null;

      return parseStoredSite(data.site, slug);
    } catch (cause) {
      // A draft belonging to someone else is a permission denial. From the
      // owner's dashboard that is indistinguishable from "not yours", so it is
      // null rather than an error the UI has to interpret.
      if (isPermissionDenied(cause)) return null;
      throw saveFailure(cause, "Could not open this site.");
    }
  }

  async getPublic(slug: string): Promise<Site | null> {
    const db = getFirebaseDb();
    if (!db) return null;

    try {
      const snapshot = await getDoc(doc(db, "sites", slug));
      if (!snapshot.exists()) return null;

      const data = snapshot.data();
      // The rules already refuse a draft to a visitor. This second check covers
      // the owner previewing their own draft in the same browser: the read is
      // allowed, but the public page must still act as if it is not there.
      if (data.status !== "published") return null;

      return parseStoredSite(data.site, slug);
    } catch (cause) {
      if (isPermissionDenied(cause)) return null;
      throw saveFailure(cause, "Could not load this site.");
    }
  }

  async create(site: Site): Promise<Site> {
    const { db, uid } = requireOwner();
    const parsed = parseForStorage(site);
    let slug = parsed.slug;
    let denied = 0;

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
      if (attempt > 0) slug = suffixSlug(parsed.slug, randomSlugSuffix());

      const candidate: Site = { ...parsed, slug };
      const payload = {
        ownerId: uid,
        slug,
        status: "draft" as const,
        schemaVersion: candidate.version,
        name: candidate.identity.name || slug,
        site: cleanForStorage(candidate),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        // No read-then-write transaction. Reading a missing document would
        // itself need permission, and the rules refuse reads of documents that
        // are not there. A plain set is decisive on its own:
        //
        //   - a missing document is a create, and the rules allow it;
        //   - an existing document is an update, and the update rule refuses
        //     a changed `createdAt` — which this payload always has.
        //
        // So a taken address is denied rather than overwritten, and the next
        // suffix is tried. Two clients racing for the same new slug cannot both
        // win either: Firestore serialises the writes, and the loser sees an
        // existing document and is denied.
        await setDoc(doc(db, "sites", slug), payload);
        return candidate;
      } catch (cause) {
        if (isPermissionDenied(cause)) {
          denied += 1;
          continue;
        }
        throw saveFailure(cause, "Could not create this site.");
      }
    }

    // Six denials almost certainly mean the rules are missing or the database
    // was never created, not that six random suffixes were all taken. Say so,
    // because "that name is in use" would send someone editing a perfectly good
    // title in search of a problem that is not there.
    if (denied === MAX_SLUG_ATTEMPTS) {
      throw new SaveError(
        "Could not create the site. Check that Firestore is set up and the security rules are published.",
        undefined,
        "permission-denied",
      );
    }

    throw new SaveError("Could not find a free web address. Try a different name.");
  }

  async save(site: Site): Promise<void> {
    const { db } = requireOwner();
    const parsed = parseForStorage(site);

    try {
      await updateDoc(doc(db, "sites", parsed.slug), {
        site: cleanForStorage(parsed),
        name: parsed.identity.name || parsed.slug,
        schemaVersion: parsed.version,
        updatedAt: serverTimestamp(),
      });
    } catch (cause) {
      if (isNotFound(cause)) {
        throw new SaveError(
          "This site no longer exists. It may have been deleted.",
          undefined,
          "not-found",
        );
      }
      throw saveFailure(cause, "Could not save your changes.");
    }
  }

  async setStatus(slug: string, status: SiteStatus): Promise<void> {
    const { db } = requireOwner();

    try {
      await updateDoc(doc(db, "sites", slug), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (cause) {
      if (isNotFound(cause)) {
        throw new SaveError(`There is no saved site called "${slug}" to publish.`);
      }
      throw saveFailure(cause, "Could not change who can see this site.");
    }
  }

  async remove(slug: string): Promise<void> {
    const { db } = requireOwner();

    try {
      await deleteDoc(doc(db, "sites", slug));
    } catch (cause) {
      throw saveFailure(cause, "Could not delete this site.");
    }
  }
}

/* ------------------------------------------------------------------ *
 * OWNER
 * ------------------------------------------------------------------ */

/**
 * The current owner and database, or a sentence explaining what is missing.
 *
 * Called per operation instead of cached: the repository outlives a session, and
 * a cached uid would let a signed-out tab keep writing as the previous account.
 */
function requireOwner(): { db: Firestore; uid: string } {
  const user = getFirebaseAuth()?.currentUser;
  if (!user) throw new SaveError("Sign in to open your sites.");

  const db = getFirebaseDb();
  if (!db) throw new SaveError("Storage is not configured for this build.");

  return { db, uid: user.uid };
}

/* ------------------------------------------------------------------ *
 * DOCUMENTS
 * ------------------------------------------------------------------ */

/**
 * Firestore rejects `undefined` values, and optional text fields can be absent
 * from a Zod result. A JSON round-trip drops those keys, which is exactly the
 * representation the local backend already stores.
 */
function cleanForStorage(site: Site): Site {
  return JSON.parse(JSON.stringify(site)) as Site;
}

function summaryOf(snapshot: QueryDocumentSnapshot): SiteSummary {
  const data = snapshot.data();

  return {
    slug: snapshot.id,
    status: readStatus(data.status),
    name: typeof data.name === "string" && data.name ? data.name : snapshot.id,
    updatedAt: toIso(data.updatedAt),
  };
}

function readStatus(value: unknown): SiteStatus {
  return value === "published" || value === "submitted" ? value : "draft";
}

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === "string" && value) return value;
  // A pending server timestamp, or a document written before this field
  // existed. The shelf renders an empty timestamp as "recently", which is
  // true enough and does not invent a date in 1970.
  return "";
}

/* ------------------------------------------------------------------ *
 * ERRORS
 * ------------------------------------------------------------------ */

function errorCode(cause: unknown): string | undefined {
  if (typeof cause !== "object" || cause === null || !("code" in cause)) {
    return undefined;
  }
  const code = (cause as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function isPermissionDenied(cause: unknown): boolean {
  return errorCode(cause) === "permission-denied";
}

function isNotFound(cause: unknown): boolean {
  return errorCode(cause) === "not-found";
}

/**
 * Turns a Firestore failure into something worth showing a person.
 *
 * The raw codes are useful to us and meaningless to the author, so each one
 * gets a sentence that suggests what to do next.
 */
function saveFailure(cause: unknown, fallback: string): SaveError {
  if (cause instanceof SaveError) return cause;

  const code = errorCode(cause);

  if (code === "unavailable" || code === "deadline-exceeded") {
    return new SaveError(
      "Could not reach storage. Check your connection and try again.",
      undefined,
      code,
    );
  }

  if (code === "permission-denied") {
    return new SaveError(
      "You do not have access to this site. It may belong to another account.",
      undefined,
      code,
    );
  }

  if (code === "not-found") {
    return new SaveError("This site no longer exists.", undefined, code);
  }

  return new SaveError(
    cause instanceof Error && cause.message ? cause.message : fallback,
    undefined,
    code,
  );
}
