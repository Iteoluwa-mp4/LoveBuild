/**
 * The scrapbook template's routes.
 *
 * Same rule as `modern/paths.ts` and `lib/site/paths.ts`: a template never
 * writes its own routes out. They are derived from a base the router supplies,
 * so moving the template cannot leave a link pointing at a page that no longer
 * exists.
 */

/** Where the router mounts the scrapbook template. */
export const SCRAPBOOK_BASE = "/templates/scrapbook";

function trimTrailing(basePath: string): string {
  return basePath.replace(/\/+$/, "");
}

export type ScrapbookPaths = {
  /** The home page. */
  home: string;
  /** The gallery. */
  gallery: string;
  /** The in-page album anchor, on the home page. */
  album: string;
};

export function scrapbookPaths(
  basePath: string = SCRAPBOOK_BASE,
): ScrapbookPaths {
  const base = trimTrailing(basePath);
  return {
    home: base || "/",
    gallery: `${base}/gallery`,
    album: `${base}#album`,
  };
}