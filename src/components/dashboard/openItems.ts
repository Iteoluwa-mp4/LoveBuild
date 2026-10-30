import type { Site } from "../../lib/site/schema";

/**
 * Which item panels start open.
 *
 * The rule is one sentence: **nothing starts open unless it is completely
 * empty.**
 *
 * A panel with anything in it is work the author has already begun, and opening
 * it on arrival hides the panel next to it. Four moments and four chapters
 * rendered open is a wall of identical cards, and a chapter of five videos is
 * as much of a wall as a chapter itself.
 *
 * A panel with nothing in it is the opposite — it is the one thing the author
 * has not touched — and opening it puts the first field under their cursor
 * instead of behind a disclosure they have to guess at. That is the only
 * exception, and it is why the test is "completely empty" rather than "missing
 * a photo": a moment the author has already written a caption for is a panel
 * they have been in, and it stays shut.
 *
 * This lives apart from the editors so that the decision is a plain function
 * of the site and can be tested without rendering anything.
 */

/** The panels that start open, by kind. */
export type InitiallyOpen = {
  /** Moments with nothing in them at all. */
  moments: string[];
  /** Chapters with no films and no stills yet. */
  chapters: string[];
  /** Films. Always empty — see the note above. */
  films: string[];
  /** Stills. Always empty — see the note above. */
  stills: string[];
};

/**
 * A moment nobody has touched.
 *
 * No photograph, no caption, no reveal text. A photograph alone does not count
 * as touched, because the seed site ships moments with their wording written
 * and their photographs still to upload — those are panels the author has
 * been in, and the demo must not arrive with four of them open.
 */
function isUntouchedMoment(moment: {
  caption: string;
  secret: string;
  image: { url: string };
}): boolean {
  return (
    moment.image.url.trim().length === 0 &&
    moment.caption.trim().length === 0 &&
    moment.secret.trim().length === 0
  );
}

/**
 * The panels that start open for a given site.
 *
 * A null site opens nothing: there is nothing to open.
 */
export function initiallyOpenItems(site: Site | null): InitiallyOpen {
  if (!site) {
    return { moments: [], chapters: [], films: [], stills: [] };
  }

  const chapters = site.gallery.chapters;

  return {
    moments: site.home.moments.filter(isUntouchedMoment).map((moment) => moment.id),
    chapters: chapters
      .filter((chapter) => chapter.films.length === 0 && chapter.stills.length === 0)
      .map((chapter) => chapter.id),
    /*
      Films and stills start closed whatever is in them. They are the items
      most likely to be numerous — a chapter can hold five videos — and they
      are never the untouched one, because an empty chapter opens itself
      instead.
    */
    films: [],
    stills: [],
  };
}
