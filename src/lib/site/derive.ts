import type { Issue, Moment, Site } from "./schema";
import { findSampleText, sampleTextLabel } from "./default";
import { findSubmissionIssues, submissionChecks } from "./schema";
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

/**
 * How close a site is to being worth sharing.
 *
 * One formula, so the dashboard cannot contradict itself. It backs the publish
 * dock's caution — whether there is anything still outstanding when the author
 * confirms — and nothing else.
 *
 * It is deliberately **not** what the upload ring shows. The ring counts
 * uploads and the words that belong to them; this counts every required field,
 * the headings and the letter included. Two different questions, and a site
 * can be at 100% on the ring while still being missing its hero line.
 *
 * Two things are counted, and they are counted separately because they are
 * different mistakes:
 *
 *   - **Structure.** The requirements from `submissionChecks` — a required
 *     field that is empty, a file that never finished uploading.
 *   - **Placeholder.** Fields still holding the sample wording. These pass the
 *     structural check and still must not ship, which is exactly why the
 *     sample fills every text field and still has work to do.
 *
 * `done` counts only structural requirements, because a field holding sample
 * copy is not finished — but the percentage is deliberately *not* the
 * structural ratio alone. A site that is structurally complete and entirely
 * placeholder is at zero percent, because the person reading it would have to
 * write every word themselves.
 */
export type Readiness = {
  /** Work items finished. */
  done: number;
  /** Every work item, finished or not. */
  total: number;
  /** Work items still outstanding. */
  missing: number;
  /** Fields still holding the sample wording. */
  placeholder: number;
  /** 0–100. */
  percent: number;
  /** True when nothing at all is outstanding. */
  complete: boolean;
};

export function readiness(site: Site): Readiness {
  const checks = submissionChecks(site);
  const placeholders = new Set(findSampleIssues(site).map((issue) => issue.path));

  /*
   * One work item per field, not per complaint.
   *
   * A field that is both required and still holding sample copy is one thing
   * the author has to do, not two — so it is counted once, and it is only
   * finished when it is both non-empty and no longer the sample text.
   */
  const items = new Map<string, { ok: boolean }>();
  for (const check of checks) {
    items.set(check.path, { ok: check.ok });
  }
  for (const path of placeholders) {
    const existing = items.get(path);
    if (existing) existing.ok = false;
    else items.set(path, { ok: false });
  }

  const total = items.size;
  const done = [...items.values()].filter((item) => item.ok).length;

  return {
    done,
    total,
    missing: total - done,
    placeholder: placeholders.size,
    percent: total === 0 ? 100 : Math.round((done / total) * 100),
    complete: total > 0 && done === total,
  };
}

/* ------------------------------------------------------------------ *
 * UPLOAD PROGRESS
 * ------------------------------------------------------------------ */

/**
 * How much of the site's media has actually been brought.
 *
 * A different question from `readiness`, and deliberately so.
 *
 * `readiness` asks "is this complete?" and counts every field, including the
 * ones that only describe the layout — the site name, the headline, the button
 * labels. Those are cheap to write and they are not *work*. A site with a
 * photograph and no caption is missing something real; a site with a caption and
 * no photograph is missing something more real. Counting a heading as half the
 * job made the number meaningless, because the number was mostly about typing.
 *
 * So this counts uploads, and the words that belong to them:
 *
 *   - every photograph and every clip,
 *   - the caption under a photograph and the title on a clip,
 *   - and whether there is at least one moment and at least one reel at all.
 *
 * Layout copy is not counted. A heading is not a task.
 *
 * A caption and a title still have to be *written* rather than left holding the
 * sample wording, because the words under a photograph are the context for that
 * photograph — the one piece of text in the site that cannot be skipped and
 * cannot be boilerplate.
 */
export type UploadProgress = {
  /** Uploads and their context, finished. */
  done: number;
  /** Every upload and its context. */
  total: number;
  /** Still outstanding. */
  missing: number;
  /** 0–100. */
  percent: number;
  /** True when nothing is outstanding. */
  complete: boolean;
};

/**
 * One piece of media work, and whether it is finished.
 *
 * The list that `uploadProgress` counts. Split out for exactly the reason
 * `submissionChecks` was split out from `findSubmissionIssues`: "20 things to
 * do" and the list of those twenty things are two views of one decision, and
 * computed separately they eventually disagree — the header says one number and
 * the list underneath holds a different number of rows.
 *
 * Every entry has a message, finished or not. The dashboard only shows the
 * unfinished ones, but a uniform shape means the count and the rows come from
 * one array rather than two.
 */
export type UploadItem = {
  /** Dotted config path, for the dashboard to jump to. */
  path: string;
  /** What is outstanding, in words the author can act on. */
  message: string;
  /** True when this one is done. */
  ok: boolean;
};

/**
 * Everything on the site that counts as media work, finished or not.
 *
 * See `uploadProgress` for what is deliberately absent: layout copy is not
 * counted, because a heading is not a task.
 */
export function uploadItems(site: Site): UploadItem[] {
  /* The fields still holding the sample wording, so a caption can be told apart
     from a caption somebody actually wrote. */
  const placeholders = new Set(findSampleIssues(site).map((issue) => issue.path));

  /**
   * One media slot: does it hold a file somebody else could open?
   *
   * Three cases, and they read differently on purpose:
   *
   *   - **Empty** — never filled in. "has no file yet" is work still owed, and
   *     it is obviously the case from the field itself.
   *   - **A `blob:` URL** — *was* filled in, looked finished, and died with the
   *     tab that created it. This is data written by an earlier build, before
   *     uploads reached Cloudinary. It is the dangerous case: a non-empty
   *     string, so a length test calls it done while every photograph on the
   *     site is broken to everyone except the person who uploaded it. It has to
   *     be called by name or it will never be noticed.
   *   - **Anything else** — a real URL.
   *
   * `ok` and the message are decided together for the reason `text` gives below:
   * two tests of one condition are two tests that can drift.
   */
  const media = (path: string, label: string, url: string): UploadItem => {
    const value = url.trim();
    if (value.length === 0) return { path, message: `${label} has no file yet`, ok: false };
    if (value.startsWith("blob:"))
      return {
        path,
        message: `${label} needs re-uploading — its file did not survive a reload`,
        ok: false,
      };
    return { path, message: label, ok: true };
  };

  /**
   * A required text field: its label, whether it is finished, and what to say
   * when it is not.
   *
   * `ok` and the message are decided in one expression on purpose. They used to
   * be two separate tests, and two tests of the same condition are two tests
   * that can drift until the list shows a row the count has already cleared.
   */
  const text = (path: string, value: string, label: string): UploadItem => {
    if (value.trim().length === 0) return { path, message: `${label} is empty`, ok: false };
    if (placeholders.has(path))
      return { path, message: `${label} still has the placeholder text`, ok: false };
    return { path, message: label, ok: true };
  };

  const items: UploadItem[] = [];

  items.push({
    path: "home.moments",
    message: "Add at least one photograph",
    ok: site.home.moments.length > 0,
  });

  site.home.moments.forEach((moment, i) => {
    items.push(media(`home.moments.${i}.image.url`, `Photo ${i + 1}`, moment.image.url));
    items.push(text(`home.moments.${i}.caption`, moment.caption, `Photo ${i + 1} caption`));
  });

  items.push({
    path: "gallery.chapters",
    message: "Add at least one chapter",
    ok: site.gallery.chapters.length > 0,
  });

  site.gallery.chapters.forEach((chapter, ci) => {
    /* A reel with nothing in it has no upload behind it either. */
    items.push({
      path: `gallery.chapters.${ci}`,
      message: `"${chapter.title || `Chapter ${ci + 1}`}" has no films or photographs`,
      ok: chapter.films.length > 0 || chapter.stills.length > 0,
    });

    chapter.films.forEach((film, fi) => {
      items.push(
        media(
          `gallery.chapters.${ci}.films.${fi}.src.url`,
          `Video ${fi + 1}`,
          film.src.url,
        ),
      );
      items.push(
        text(`gallery.chapters.${ci}.films.${fi}.title`, film.title, `Video ${fi + 1} title`),
      );
    });

    /*
      A still's caption is not counted.
      *
      The film and the moment both have a required title or caption, so those are
      work. A still's caption is optional in the schema and in the template — the
      photograph carries the meaning and the caption is a bonus — and counting an
      optional field would make the meter demand something the site never asked
      for.
    */
    chapter.stills.forEach((still, si) => {
      items.push(
        media(`gallery.chapters.${ci}.stills.${si}.src.url`, `Photo ${si + 1}`, still.src.url),
      );
    });
  });

  return items;
}

export function uploadProgress(site: Site): UploadProgress {
  const items = uploadItems(site);
  const total = items.length;
  const done = items.filter((item) => item.ok).length;

  return {
    done,
    total,
    missing: total - done,
    percent: total === 0 ? 100 : Math.round((done / total) * 100),
    complete: total > 0 && done === total,
  };
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
 * MODERN TEMPLATE
 * ------------------------------------------------------------------ */

/**
 * One moment, in the shape the modern template's components expect.
 *
 * The mapping, and why each field lands where it does:
 *
 *   - `label`   <- `tag`, falling back to the position, so the strip and the
 *                 index always have a name to show.
 *   - `caption` <- `caption`, the short line.
 *   - `note`    <- `secret`, the longer reveal. In the classic template this is
 *                 what a tap uncovers; in the modern gallery it is the detail
 *                 panel. Same words, different surface — which is the point of
 *                 sharing the list rather than duplicating it.
 *   - `image`   <- `url`, or the generated placeholder when there is no upload.
 *
 * That last one is the reason this function exists at all rather than a filter:
 * a moment with no photo still has to appear, or an author mid-upload would see
 * the strip silently lose a slice. The generated frame keeps its slot and its
 * index, so filling in the photo is an edit rather than a repair.
 */
export type ModernMemory = {
  label: string;
  caption: string;
  note: string;
  image: string;
};

/** The placeholder frame for a moment with no photo yet. */
function placeholderImage(moment: Moment, index: number): string {
  const label = (momentTag(moment.tag, index) || "moment").toUpperCase();
  const number = pad(index + 1);

  // A generated SVG rather than a blank box, so an unfilled slot still reads as
  // part of the design. Same reasoning as MediaPlaceholder, but this one has to
  // look like a photograph because it is being handed to a WebGL texture loader
  // that will happily render nothing at all.
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='900' height='640' viewBox='0 0 900 640'%3E%3Crect width='900' height='640' fill='%23090814'/%3E%3Ctext x='450' y='330' font-family='Arial,sans-serif' font-size='120' font-weight='700' fill='%23ffffff' opacity='.9' text-anchor='middle'%3E${number}%3C/text%3E%3Ctext x='450' y='390' font-family='Arial,sans-serif' font-size='24' letter-spacing='4' fill='%23ffffff' opacity='.6' text-anchor='middle'%3E${label}%3C/text%3E%3C/svg%3E`;
}

/**
 * The site's moments, in the modern template's shape.
 *
 * Reads `home.moments` rather than anything under `modern`, which is what makes
 * a template switch non-destructive: the photographs are the one thing both
 * templates must agree on, so there is only one copy of them.
 */
export function modernMemories(site: Site): ModernMemory[] {
  return site.home.moments.map((moment, index) => ({
    label: momentTag(moment.tag, index),
    caption: moment.caption,
    note: moment.secret,
    image: moment.image.url.trim() || placeholderImage(moment, index),
  }));
}

/* ------------------------------------------------------------------ *
 * SCRAPBOOK MEMORIES
 * ------------------------------------------------------------------ */

/**
 * One photograph as the scrapbook presents it: a caption on the white border,
 * a note to read when it is opened, a stamped date, and how it sits on the page.
 *
 * Lives here rather than in `components/site/scrapbook/shared.tsx` so that
 * `lib` never imports from `components` — the dependency only ever runs the
 * other way. The scrapbook components import this type.
 */
export type ScrapbookMemory = {
  /** Printed on the polaroid's white border. */
  caption: string;
  /** The longer note, shown when a photo is opened. */
  note: string;
  /** A short date, stamped. */
  date: string;
  /**
   * Degrees of tilt.
   *
   * The rotation is data rather than CSS because it is the one thing that makes
   * a grid of identical cards read as scattered rather than aligned — and it has
   * to be stable across renders, or the layout jumps on every state change.
   */
  tilt: number;
  /** Which strip of tape holds this one down, and how it sits. */
  tape: "top-left" | "top-right" | "top-center" | "none";
  /** The photograph. A placeholder stands in until one is uploaded. */
  image: string;
};

/**
 * Tilt and tape are cycled rather than random.
 *
 * A random value would be re-rolled on every render and the polaroids would
 * jump around the page while someone was reading them. Six values repeated by
 * index gives the same scattered look, and gives it identically every time.
 */
const SB_TILTS = [-3.2, 2.6, -1.8, 3.4, -2.4, 1.9];
const SB_TAPES: ScrapbookMemory["tape"][] = [
  "top-center",
  "top-left",
  "top-right",
  "top-center",
  "top-left",
  "top-right",
];

/**
 * The site's moments, in the scrapbook's shape.
 *
 * Reads `home.moments` — the same single list the classic and modern templates
 * read. That is what keeps a template switch non-destructive: the photographs
 * are entered once, and changing `template` re-presents them rather than
 * stranding them. See `modernMemories` above for the same reasoning.
 *
 * Before this existed the scrapbook rendered a fixed set of six generated
 * photographs and ignored the site entirely, so choosing it in the dashboard
 * swapped the author's work for somebody else's demo.
 */
export function scrapbookMemories(site: Site): ScrapbookMemory[] {
  return site.home.moments.map((moment, index) => ({
    // The border is the card, so an empty caption would leave a blank strip
    // where every other card has handwriting. Falls back to "Moment 01".
    caption: hasContent(moment.caption) ? moment.caption.trim() : momentTag(moment.tag, index),
    note: moment.secret,
    date: moment.date,
    tilt: SB_TILTS[index % SB_TILTS.length],
    tape: SB_TAPES[index % SB_TAPES.length],
    image: moment.image.url.trim() || placeholderImage(moment, index),
  }));
}

/* ------------------------------------------------------------------ *
 * EDITORIAL MOMENTS
 * ------------------------------------------------------------------ */

/**
 * One moment, in the shape the editorial template's components expect.
 *
 * The mapping, and why each field lands where it does:
 *
 *   - `date`    <- `date`, the dateline above the story. Optional, as on the
 *                 page: an undated story simply carries no dateline.
 *   - `caption` <- `caption`, and it is load-bearing twice — the story's
 *                 headline and the figure's caption are the same words
 *                 because the magazine's contents list is derived from the
 *                 headlines. An empty one falls back to "Moment 01", the
 *                 same position-derived default every other template gets.
 *   - `note`    <- `secret`, the longer text. In the classic template this is
 *                 what a tap uncovers; in the editorial layout it is the
 *                 story body and the note beside the figure. Same words,
 *                 different surface — which is the point of sharing the list
 *                 rather than duplicating it.
 *   - `image`   <- `url`. An empty url is handed through and the component
 *                 chooses its own generated frame, so an unfilled slot keeps
 *                 its place on the page.
 */
export type EditorialMoment = {
  /** The dateline above the story. Empty means no dateline renders. */
  date: string;
  /** The story headline, the figure caption, and one contents entry. */
  caption: string;
  /** The story body, and the note beside the figure in the spread. */
  note: string;
  /** The photograph's URL, or empty when no upload has arrived yet. */
  image: string;
};

/**
 * The site's moments, in the editorial template's shape.
 *
 * Reads `home.moments` rather than anything under `editorial`, which is what
 * makes a template switch non-destructive: the photographs are the one thing
 * every template must agree on, so there is only one copy of them. See
 * `modernMemories` above for the same reasoning, and `modernSchema` in
 * `schema.ts` for why the template's own section holds no media.
 */
export function editorialMoments(site: Site): EditorialMoment[] {
  return site.home.moments.map((moment, index) => ({
    date: moment.date,
    caption: hasContent(moment.caption) ? moment.caption.trim() : momentTag(moment.tag, index),
    note: moment.secret,
    image: moment.image.url.trim(),
  }));
}

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