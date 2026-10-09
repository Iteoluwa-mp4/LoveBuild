/**
 * The modern template's routes.
 *
 * Same reasoning as `lib/site/paths.ts`, one scope down: every internal link in a
 * template is derived from a base path rather than written out. When the gallery
 * link was a bare `/gallery` in the classic template, the page silently rendered
 * the not-found screen after sites moved to `/s/:slug` — the path was correct
 * when written, wrong when the route table changed, and nothing failed loudly.
 *
 * The base is a parameter rather than a constant so that this template can be
 * served from `/s/:slug` later without every link needing rewriting. For now the
 * router mounts it at `MODERN_BASE`.
 */

/** Where the router mounts the modern template. */
export const MODERN_BASE = "/templates/modern";

/** Strips trailing slashes so joins never double them. */
function trimTrailing(basePath: string): string {
  return basePath.replace(/\/+$/, "");
}

export type ModernPaths = {
  /** The home page. */
  home: string;
  /** The gallery. */
  gallery: string;
  /** The in-page archive anchor, on the home page. */
  archive: string;
};

export function modernPaths(basePath: string = MODERN_BASE): ModernPaths {
  const base = trimTrailing(basePath);
  return {
    home: base || "/",
    gallery: `${base}/gallery`,
    archive: `${base}#archive`,
  };
}