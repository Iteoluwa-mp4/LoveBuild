/**
 * A site's routes, in one place.
 *
 * Every internal link in the template used to be assembled at its call site.
 * That is how the gallery link ended up pointing at a bare `/gallery` after
 * sites moved to `/s/:slug`: the path was correct when written, wrong when the
 * route table changed, and nothing failed loudly — it just rendered the
 * not-found screen.
 *
 * So paths are derived here, once, from the base path the router already knows.
 * A caller cannot get it wrong without changing this file.
 */

/**
 * Strips trailing slashes so joins never double them.
 *
 * `"/"` reduces to `""`, which matters more than it looks: naively appending
 * gives `"//gallery"`, and that is a *protocol-relative* URL — a browser reads it
 * as "gallery, on some other host". A root base is not reachable today, but the
 * helper should not be able to emit a link that leaves the origin.
 */
function trimTrailing(basePath: string): string {
  return basePath.replace(/\/+$/, "");
}

export type SitePaths = {
  /** The home page. */
  home: string;
  /** The gallery. */
  gallery: string;
};

export function sitePaths(basePath: string): SitePaths {
  const base = trimTrailing(basePath);
  return { home: base || "/", gallery: `${base}/gallery` };
}

/** The in-page anchor for the moments strip. */
export function momentsAnchor(basePath: string): string {
  return `${trimTrailing(basePath) || "/"}#moments`;
}

/**
 * True when `href` points somewhere inside this site, rather than off-site or
 * to an anchor.
 *
 * The preview uses this to keep its buttons from navigating the iframe away.
 * Absolute and protocol-relative URLs, `mailto:`, and bare `#fragments` are all
 * left alone.
 */
export function isInternalPageLink(href: string): boolean {
  if (!href.startsWith("/")) return false;
  // "//example.com" is protocol-relative, not a path on this origin.
  if (href.startsWith("//")) return false;
  // A fragment-only link stays on the current page.
  if (href.startsWith("#")) return false;
  return true;
}