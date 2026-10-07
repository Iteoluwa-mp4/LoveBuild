import { getRepository } from "./getRepository";
import type { Site, SiteStatus } from "./schema";

/**
 * Loading a published site.
 *
 * Unauthenticated on purpose. This is the visitor's read, so it runs as `anon`
 * and row level security decides what comes back — a draft comes back as null,
 * which from out here is the same as the site not existing. That is the correct
 * answer rather than an error, and it means there is no code path here that
 * *could* leak a draft.
 *
 * Step 4a stubbed this by returning the local seed. The interface did not
 * change.
 */

export type LoadState =
  | { status: "ready"; site: Site; siteStatus: SiteStatus }
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error"; message: string };

export async function loadSite(slug: string | undefined): Promise<LoadState> {
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return { status: "missing" };

  try {
    const site = await getRepository().getPublic(slug);
    if (!site) return { status: "missing" };

    // A published read is by definition published; the local backend stores
    // status beside the config, so ask it rather than assuming.
    return {
      status: "ready",
      site,
      siteStatus: await readStatus(slug),
    };
  } catch (cause) {
    return {
      status: "error",
      message: cause instanceof Error ? cause.message : "Could not load this site.",
    };
  }
}

async function readStatus(slug: string): Promise<SiteStatus> {
  try {
    const list = await getRepository().list();
    return list.find((s) => s.slug === slug)?.status ?? "published";
  } catch {
    // An unauthenticated visitor cannot list anything, which is correct. The
    // site rendered, so it was published.
    return "published";
  }
}