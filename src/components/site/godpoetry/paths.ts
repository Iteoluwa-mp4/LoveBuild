/**
 * The God Poetry template's routes.
 *
 * Same rule as every other template: internal links are derived from the base
 * the router supplies, so the published site and the standalone preview cannot
 * point at different pages. The published home is `/s/:slug` and the gallery
 * sits beside it; the development preview mounts at `GOD_POETRY_BASE`.
 */

/** Where the router mounts the private God Poetry preview. */
export const GOD_POETRY_BASE = "/templates/god-poetry";

function trimTrailing(basePath: string): string {
  return basePath.replace(/\/+$/, "");
}

export type GodPoetryPaths = {
  /** The blessing itself. */
  home: string;
  /** The photographs, called "the little things" in the nav. */
  gallery: string;
  /** The word section on the home page. */
  word: string;
  /** The poem section on the home page. */
  poem: string;
  /** The letter section on the home page. */
  letter: string;
};

export function godPoetryPaths(basePath: string = GOD_POETRY_BASE): GodPoetryPaths {
  const base = trimTrailing(basePath);
  return {
    home: base || "/",
    gallery: `${base}/gallery`,
    word: `${base || "/"}#word`,
    poem: `${base || "/"}#poem`,
    letter: `${base || "/"}#letter`,
  };
}
