import { sitePaths } from "./paths";
import { chapterLabel } from "./derive";
import type { Site } from "./schema";

/**
 * The footer sitemap.
 *
 * Every link on a published site, derived from the site itself. Two things make
 * it worth generating rather than hand-writing:
 *
 *   - Chapters are all on ONE scroll-snapped page, so they are anchors into the
 *     gallery rather than separate routes. A new chapter joins the sitemap with
 *     no code change.
 *   - Chapter count is unbounded, so the list is capped. A footer that grows to
 *     forty links is worse than one that quietly shows the first few.
 */

/** Beyond this the list stops being navigation and starts being an index. */
export const MAX_SITEMAP_CHAPTERS = 8;

export type SitemapLink = {
  label: string;
  to: string;
};

export type Sitemap = {
  pages: SitemapLink[];
  chapters: SitemapLink[];
  /** True when chapters exist but are not all listed. */
  chaptersTruncated: boolean;
};

export function buildSitemap(site: Site, basePath: string): Sitemap {
  const paths = sitePaths(basePath);
  const gallery = paths.gallery;

  const listed = site.gallery.chapters.slice(0, MAX_SITEMAP_CHAPTERS);

  return {
    pages: [
      { label: "Home", to: paths.home },
      // Pointless when there is only ever one chapter.
      { label: "The gallery", to: gallery },
    ],
    chapters: listed.map((chapter, i) => ({
      label: `${chapterLabel(chapter.label, i)}. ${chapter.title || "Untitled"}`,
      to: `${gallery}#${chapter.id}`,
    })),
    chaptersTruncated: site.gallery.chapters.length > MAX_SITEMAP_CHAPTERS,
  };
}

/** Where the owner goes to edit, for this specific site. */
export function editUrl(slug: string): string {
  return `/dashboard/${slug}`;
}
