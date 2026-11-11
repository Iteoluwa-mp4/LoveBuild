/**
 * The editorial template's routes.
 *
 * Same rule as `modern/paths.ts` and `scrapbook/paths.ts`: every internal link
 * in a template is derived from a base path rather than written out. The
 * router mounts this template at `EDITORIAL_BASE` in `/dev`, and at
 * `/s/:slug` when it is published — two different homes, one link table.
 *
 * The base is a parameter rather than a constant so that neither mounting can
 * leave a link pointing at a page that does not exist.
 */

/** Where the router mounts the editorial template. */
export const EDITORIAL_BASE = "/templates/editorial";

/** Strips trailing slashes so joins never double them. */
function trimTrailing(basePath: string): string {
  return basePath.replace(/\/+$/, "");
}

export type EditorialPaths = {
  /** The issue — the magazine itself. */
  home: string;
  /** The figures page, where every photograph sits with its credit. */
  gallery: string;
};

export function editorialPaths(basePath: string = EDITORIAL_BASE): EditorialPaths {
  const base = trimTrailing(basePath);
  return {
    home: base || "/",
    gallery: `${base}/gallery`,
  };
}
