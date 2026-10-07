import type { Issue, Site } from "./schema";
import { findSampleText, sampleTextLabel } from "./default";
import { findSubmissionIssues } from "./schema";
import { countLabel } from "../format";
import { momentsAnchor, sitePaths } from "./paths";

/**
 * Everything that can be computed rather than stored.
 *
 * Two rules produced this module:
 *
 *   1. A value that can be derived from position must not be a field. Moment
 *      tags, chapter numbers and button targets are all the same number counted
 *      differently, and storing them means they can disagree with each other.
 *
 *   2. A region with no content must not render. A draft is allowed to be
 *      unfinished, so an author who skips the quote letter should get a shorter
 *      page rather than an empty panel with a button that opens onto nothing.
 *
 * Pure functions only. No components, no state, no config lookups — which means
 * this is where the behaviour lives and where the tests point.
 */

/* ------------------------------------------------------------------ *
 * READINESS
 * ------------------------------------------------------------------ */

/**
 * Fields still holding the placeholder wording.
 *
 * Separate from `findSubmissionIssues` rather than folded into it, because the
 * two answer different questions. That one asks "is this site complete?" — a
 * filled-in field holding sample text is not missing. This asks "is this still
 * the placeholder?", which is what stops a template's dummy copy from shipping
 * as though a person had written it.
 *
 * One issue per field, so the dashboard can link straight to the offender.
 */
export function findSampleIssues(site: Site): Issue[] {
  return findSampleText(site).map((path) => ({
    path,
    message: `${sampleTextLabel(path)} still has the placeholder text`,
  }));
}

/**
 * Everything wrong with a site, for the "before you send this" check.
 *
 * Placeholder text first, because it is the one that is easy to miss: a site can
 * be structurally complete — every file uploaded, every heading filled in — and
 * still ship two dozen lines a developer wrote.
 */
export function findIssues(site: Site): Issue[] {
  return [...findSampleIssues(site), ...findSubmissionIssues(site)];
}

/* ------------------------------------------------------------------ *
 * CONTENT TESTS
 * ------------------------------------------------------------------ */

/** True when a string holds anything other than whitespace. */
export function hasContent(value: string | undefined | null): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/** True when any of the given strings holds content. */
function anyContent(...values: (string | undefined)[]): boolean {
  return values.some(hasContent);
}

/* ------------------------------------------------------------------ *
 * DERIVED LABELS
 * ------------------------------------------------------------------ */

/** "01", "02", ... Used for chapter numbers. */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * The label above a moment's photo. Falls back to its position, so an author
 * who does not care gets "Moment 01" for free.
 */
export function momentTag(tag: string, index: number): string {
  return hasContent(tag) ? tag.trim() : `Moment ${pad(index + 1)}`;
}

/** The number above a chapter's title. Falls back to its position. */
export function chapterLabel(label: string, index: number): string {
  return hasContent(label) ? label.trim() : pad(index + 1);
}

/* ------------------------------------------------------------------ *
 * DERIVED LINKS
 * ------------------------------------------------------------------ */

/** Where a call-to-action points. */
export type CtaTarget = "gallery" | "moments";

/**
 * The href for a button.
 *
 * `basePath` is required, deliberately. This used to default to `""` and ignore
 * it entirely for the gallery case, returning a bare `/gallery` — correct when
 * the site lived at the root, wrong the moment it moved to `/s/:slug`, and it
 * failed by rendering the not-found screen rather than by complaining. No
 * default means a caller cannot leave it out.
 *
 * Both branches go through `paths.ts`, so a site can never mix two conventions.
 */
export function ctaTarget(target: CtaTarget, basePath: string): string {
  return target === "gallery" ? sitePaths(basePath).gallery : momentsAnchor(basePath);
}

/* ------------------------------------------------------------------ *
 * DERIVED EMPHASIS
 * ------------------------------------------------------------------ */

export type EmphasisParts = {
  /** Rendered plain. */
  lead: string;
  /** Rendered in the accent gradient. */
  emphasis: string;
  /** Anything after the highlighted span. Usually empty. */
  tail: string;
};

/** Matches sentence-ending punctuation that is followed by a space or the end. */
const SENTENCE_END = /[.!?…](?=\s|$)/g;

/**
 * Splits a quote so its final sentence can be highlighted.
 *
 * There is no stored emphasis field, deliberately. An earlier version kept the
 * highlighted phrase as a separate string, and the moment its author edited his
 * own sentence the two stopped matching and the highlight silently disappeared.
 * Deriving it means there is nothing to fall out of sync.
 *
 * A quote that is a single sentence highlights all of it. Anything too short to
 * be a sentence falls back to highlighting the whole quote rather than a
 * two-character fragment.
 */
export function emphasisParts(text: string): EmphasisParts {
  const trimmed = text.trim();
  if (!trimmed) return { lead: "", emphasis: "", tail: "" };

  const ends = [...trimmed.matchAll(SENTENCE_END)];
  if (ends.length === 0) return { lead: "", emphasis: trimmed, tail: "" };

  const lastEnd = (ends.at(-1)?.index ?? 0) + 1;
  const previous = ends.length > 1 ? ends[ends.length - 2]?.index : undefined;
  const start = previous === undefined ? 0 : previous + 1;

  const emphasis = trimmed.slice(start, lastEnd).trim();
  if (emphasis.length < 3) return { lead: "", emphasis: trimmed, tail: "" };

  return {
    lead: trimmed.slice(0, start).trim(),
    emphasis,
    tail: trimmed.slice(lastEnd).trim(),
  };
}

/* ------------------------------------------------------------------ *
 * VISIBILITY
 * ------------------------------------------------------------------ */

/**
 * Which regions of the site have enough content to render.
 *
 * Derived rather than stored: a stored `showQuote` flag can drift out of sync
 * with the quote it guards, and then you are back to debugging empty panels.
 *
 * Two kinds of region, and they behave differently on purpose:
 *
 *   Media sections (moments, chapters) ALWAYS render. An empty photo slot is
 *   already an honest, useful gap — a dashed box that says "Add a picture" —
 *   so hiding the whole section would throw away the structure for no gain. It
 *   also meant a site with nothing in it yet rendered as a blank page, which
 *   reads as broken rather than as "not started".
 *
 *   Text sections (quote, footer, outro) hide when empty. A quote panel with no
 *   words in it is a hollow glass box, which is worse than no panel.
 *
 * `quoteTruth` is separate from `quote` for exactly this reason: a quote with a
 * button that reveals an empty letter is the failure this exists to prevent.
 */
export type SiteBlocks = {
  hero: boolean;
  moments: boolean;
  quote: boolean;
  /** Only meaningful when `quote` is true. */
  quoteTruth: boolean;
  footer: boolean;
  footerCards: boolean;
  galleryHero: boolean;
  chapters: boolean;
  outro: boolean;
};

export function visibleBlocks(site: Site): SiteBlocks {
  const { home, gallery } = site;

  const quote = hasContent(home.quote.text);
  const footer = anyContent(home.footer.heading, home.footer.subline);

  return {
    hero: anyContent(...home.hero.lines, home.hero.subline, home.hero.primaryCta),
    // Media sections: always present, so the shape of the site is visible even
    // before anything has been added. The slots show their own placeholders.
    moments: true,
    quote,
    quoteTruth: quote && hasContent(home.quote.truth),
    footer,
    // Cards are chrome hanging off the footer, so they cannot outlive it.
    footerCards: footer && home.footer.cards.length > 0,
    galleryHero: anyContent(gallery.hero.lineOne, gallery.hero.lineTwo, gallery.hero.blurb),
    // As with moments.
    chapters: true,
    outro: anyContent(gallery.outro.lineOne, gallery.outro.lineTwo, gallery.outro.aside),
  };
}

/** How many empty slots to show when a media section has nothing in it yet. */
export const EMPTY_SLOT_COUNT = 2;

/* ------------------------------------------------------------------ *
 * OUTLINE
 * ------------------------------------------------------------------ */

/**
 * A flat, human-readable outline of the site.
 *
 * The dashboard shows this beside the form so its author can see what will
 * actually appear, and watch a section grey out as they clear it. It is the
 * cheapest possible defence against publishing something that looks broken.
 */
export type OutlineEntry = {
  /** Dotted config path, or null for structural nodes. */
  path: string | null;
  label: string;
  /** False when the region has no content and will not render. */
  shown: boolean;
  /** Rendered under the parent, e.g. per-chapter detail. */
  detail?: string | undefined;
  /** True for the optional blocks that collapse behind "Advanced". */
  advanced?: boolean | undefined;
};

export function siteOutline(site: Site): OutlineEntry[] {
  const blocks = visibleBlocks(site);
  const out: OutlineEntry[] = [];

  out.push({
    path: "home.hero",
    label: "Hero",
    shown: blocks.hero,
    detail: site.home.hero.lines.filter(hasContent).join(" / "),
  });

  out.push({
    path: "home.moments",
    label: `Moments (${site.home.moments.length})`,
    shown: blocks.moments,
  });

  out.push({
    path: "home.quote",
    label: "Quote",
    shown: blocks.quote,
    advanced: true,
    detail: blocks.quote ? undefined : "Add a quote, or leave blank to hide this section",
  });

  out.push({
    path: "home.quote.truth",
    label: "Your letter",
    shown: blocks.quoteTruth,
    advanced: true,
    detail: blocks.quote && !blocks.quoteTruth ? "Toggle would open onto nothing" : undefined,
  });

  out.push({
    path: "home.footer",
    label: "Closing section",
    shown: blocks.footer,
    detail: site.home.footer.heading,
  });

  out.push({
    path: "home.footer.cards",
    label: `Closing cards (${site.home.footer.cards.length})`,
    shown: blocks.footerCards,
    advanced: true,
  });

  out.push({
    path: "gallery.hero",
    label: "Gallery intro",
    shown: blocks.galleryHero,
    advanced: true,
  });

  // A summary row, so the outline still reports the section when there are no
  // chapters to list. Without it the panel goes quiet at exactly the moment
  // someone needs to be told where to add their first one.
  const chapterRows = site.gallery.chapters.map((chapter, i) => {
    const empty = chapter.films.length === 0 && chapter.stills.length === 0;
    return {
      path: `gallery.chapters.${i}`,
      label: `${chapterLabel(chapter.label, i)}. ${chapter.title || "Untitled chapter"}`,
      // An empty chapter still renders — its title screen plus its own
      // placeholder slots, same as an empty moment. "Shown" means "will appear on
      // the site", not "is finished", so the unfinished part goes in the detail.
      shown: true,
      detail: empty
        ? "No films or photographs yet"
        : [
            chapter.films.length && countLabel(chapter.films.length, "film"),
            chapter.stills.length && countLabel(chapter.stills.length, "photo"),
          ]
            .filter(Boolean)
            .join(" · "),
    };
  });

  out.push({
    path: "gallery.chapters",
    label: `Chapters (${site.gallery.chapters.length})`,
    shown: true,
    detail:
      site.gallery.chapters.length === 0 ? "Nothing here yet — add your first chapter" : undefined,
  });

  out.push(...chapterRows);

  out.push({
    path: "gallery.outro",
    label: "Gallery outro",
    shown: blocks.outro,
    advanced: true,
  });

  return out;
}