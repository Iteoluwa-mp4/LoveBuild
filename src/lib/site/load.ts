import { getRepository } from "./getRepository";
import type { Site } from "./schema";

/**
 * Loading a published site.
 *
 * Unauthenticated on purpose. This is the visitor's read, so nothing here carries
 * the owner's credentials, and a draft comes back as null — which from out here
 * is the same as the site not existing. That is the correct answer rather than an
 * error, and it means there is no code path here that *could* leak a draft.
 *
 * Note what is *not* here any more: a second call to work out the publication
 * status. `getPublic` returning a site already means it is published — that is the
 * contract of the interface — so asking again could only ever return "published".
 * Worse, the way it was asked was `list()`, which requires a session, so every
 * public page load fired an authenticated query that was guaranteed to fail, caught
 * the failure, and fell back to the answer it already had. One extra round trip per
 * visitor, to learn nothing.
 */

export type LoadState =
  | { status: "ready"; site: Site }
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error"; message: string };

export async function loadSite(slug: string | undefined): Promise<LoadState> {
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return { status: "missing" };

  try {
    const site = await getRepository().getPublic(slug);
    if (!site) return { status: "missing" };

    return { status: "ready", site };
  } catch (cause) {
    return {
      status: "error",
      message: cause instanceof Error ? cause.message : "Could not load this site.",
    };
  }
}