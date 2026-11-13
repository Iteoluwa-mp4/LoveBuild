import { z } from "zod";

/**
 * The shape of a site. This file is the single source of truth for the whole
 * app: the dashboard form is generated from it, the database column is typed by
 * it, and every component in `src/components/site` reads from it.
 *
 * Rules of the house:
 *   - Nothing in a component may hardcode content. If a string appears in JSX,
 *     it belongs in here, or it is chrome (a button label, an aria string).
 *   - A field that can be computed does not get stored. See `derive.ts`.
 *   - `version` is how config changes stay backwards compatible. Bump it and
 *     write a migration rather than reshaping old rows in place.
 *
 * A note on `.prefault()` vs `.default()`
 * -------------------------------------
 * A draft is allowed to be unfinished, so almost every field needs a fallback.
 * For nested objects that means the whole sub-tree must materialise from
 * nothing: `siteSchema.parse({ slug, theme })` should return a complete object.
 *
 * Zod 4's `.default({})` returns that object *literally*, without parsing it,
 * so inner defaults never fire and you get `home === {}`. `.prefault({})` feeds
 * the value through the schema first, which is what actually cascades.
 * Scalars use plain `.default()` because their fallback is already valid.
 */

/** A UUID. Used as a stable React key so reordering never remounts a node. */
const id = z.string().min(1);

/* ------------------------------------------------------------------ *
 * STATUS
 * ------------------------------------------------------------------ */

/**
 * A site's publication state.
 *
 * This lives in the database column, NOT in the config object. It used to be in
 * both, which meant a `sites.status` column and a `site.status` field could
 * disagree — and nothing would say so. Row level security keys off the column,
 * so the column has to be the only source of truth.
 *
 * `draft` is invisible to the public. `submitted` is also invisible and exists
 * only if a review gate is ever wanted. `published` is what the shared link
 * serves.
 *
 * Exported from here because it is the shared vocabulary between the schema, the
 * repository and the dashboard — but deliberately absent from `siteSchema`.
 */
export const statusSchema = z.enum(["draft", "submitted", "published"]);
export type SiteStatus = z.infer<typeof statusSchema>;

/* ------------------------------------------------------------------ *
 * MEDIA
 * ------------------------------------------------------------------ */

/**
 * One uploaded asset.
 *
 * `url` is authoritative for rendering. `publicId` is the Cloudinary asset id,
 * set once the upload completes, and is what you need in order to delete the
 * asset later or rebuild it at a different width. `publicId` is nullable
 * because seed content points at local files until it is uploaded.
 *
 * Deliberately an object and not a bare URL string: a string cannot carry alt
 * text, a caption, intrinsic dimensions, or a stable key for reordering.
 */
export const mediaSchema = z.object({
  id,
  /** Cloudinary public id. null while the asset has not been uploaded yet. */
  publicId: z.string().nullable().default(null),
  /** Direct URL the renderer uses. */
  url: z.string(),
  /** Accessibility text. Falls back to `caption`, then to a generic phrase. */
  alt: z.string().max(300).default(""),
  /** Visible caption. */
  caption: z.string().max(300).default(""),
  /** Intrinsic size, once known. Used to reserve layout space and avoid CLS. */
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
  /** Video length in milliseconds. */
  durationMs: z.number().int().nonnegative().nullable().default(null),
});
export type Media = z.infer<typeof mediaSchema>;

/* ------------------------------------------------------------------ *
 * HOME
 * ------------------------------------------------------------------ */

/**
 * The hero headline, split into lines so each can be revealed in sequence. The
 * last line carries the accent gradient. The current layout is tuned for three
 * lines; one to four render without breaking.
 */
const heroLinesSchema = z.array(z.string().max(90)).min(1).max(4).default(["", "", ""]);

/**
 * A photo that flips to reveal a hidden message when clicked.
 *
 * `tag` and `date` are optional on purpose. Left blank, `momentTag` derives
 * "Moment 01" and the date slot simply does not render. He can customise
 * either, but is never asked to.
 *
 * Shared by both templates on purpose. The modern template presents these same
 * photographs as a strip and a sphere rather than as a grid, but storing a
 * second list would mean every upload had to be entered twice and switching
 * `template` could strand the one the author was not currently looking at.
 */
const momentSchema = z.object({
  id,
  /** Small label above the card. Empty derives "Moment 01", "Moment 02"... */
  tag: z.string().max(40).default(""),
  /** Short date shown on the reverse, e.g. "October 14". Optional. */
  date: z.string().max(40).default(""),
  /** The prompt printed over the photo. */
  caption: z.string().max(300).default(""),
  /** The reveal text on the back. */
  secret: z.string().max(600).default(""),
  image: mediaSchema,
});
export type Moment = z.infer<typeof momentSchema>;

/**
 * The pull-quote panel, which toggles to a longer letter.
 *
 * There is deliberately no `emphasis` field. An earlier version stored the
 * gradient-highlighted phrase separately from the quote text, which meant the
 * moment its author edited his own sentence the phrase stopped matching and the
 * highlight silently vanished. `emphasisParts` in `derive.ts` derives it from
 * the text instead, so it cannot break.
 *
 * `truth` is a single string; paragraphs are split on blank lines. Keeping it
 * one field means one textarea in the dashboard rather than a paragraph editor.
 *
 * Every field here is optional. An author who never fills this in gets no quote
 * panel at all, which `visibleBlocks` decides.
 */
const quoteSchema = z
  .object({
    text: z.string().max(2000).default(""),
    /** The longer letter revealed by the toggle. */
    truth: z.string().max(8000).default(""),
    author: z.string().max(120).default(""),
    authorSub: z.string().max(200).default(""),
    verdictLabel: z.string().max(60).default(""),
    verdictValue: z.string().max(60).default(""),
    /** Label on the toggle while the letter is hidden. */
    toggleReveal: z.string().max(40).default(""),
    /** Label on the toggle while the letter is showing. */
    toggleBack: z.string().max(40).default(""),
  })
  .prefault({});

/** A quote card in the closing fan. */
const footerCardSchema = z.object({
  id,
  tag: z.string().max(40).default(""),
  quote: z.string().max(400).default(""),
});
export type FooterCard = z.infer<typeof footerCardSchema>;

const homeSchema = z
  .object({
    hero: z
      .object({
        lines: heroLinesSchema,
        subline: z.string().max(300).default(""),
        /** Label only. The target is derived: primary opens the gallery. */
        primaryCta: z.string().max(60).default(""),
        /** Label only. The target is derived: secondary jumps to #moments. */
        secondaryCta: z.string().max(60).default(""),
      })
      .prefault({}),
    moments: z.array(momentSchema).max(30).default([]),
    quote: quoteSchema,
    footer: z
      .object({
        heading: z.string().max(200).default(""),
        subline: z.string().max(300).default(""),
        /** Label only. The target is derived: footer button opens the gallery. */
        ctaLabel: z.string().max(60).default(""),
        cards: z.array(footerCardSchema).max(12).default([]),
      })
      .prefault({}),
  })
  .prefault({});

/* ------------------------------------------------------------------ *
 * GALLERY
 * ------------------------------------------------------------------ */

/** One video, with a line of text addressed to the reader beside it. */
const filmSchema = z.object({
  id,
  title: z.string().max(200).default(""),
  /** The line spoken beside the clip. */
  note: z.string().max(1000).default(""),
  src: mediaSchema,
});
export type Film = z.infer<typeof filmSchema>;

/** One photograph with a small caption underneath. */
const stillSchema = z.object({
  id,
  caption: z.string().max(300).default(""),
  src: mediaSchema,
});
export type Still = z.infer<typeof stillSchema>;

/**
 * A titled group of films and photographs. The gallery renders a chapter's
 * title screen, then one screen per film, then one screen of photographs.
 * A chapter may hold either, both, or neither.
 *
 * This nesting is the whole shape of the gallery. Flattening films and stills
 * into one list would lose the grouping that gives the page its narrative.
 */
const chapterSchema = z.object({
  id,
  /** Shown above the title. Empty derives "01", "02" from position. */
  label: z.string().max(10).default(""),
  title: z.string().max(120).default(""),
  /** One line introducing the chapter. Omit for none. */
  blurb: z.string().max(400).optional(),
  films: z.array(filmSchema).max(50).default([]),
  stills: z.array(stillSchema).max(50).default([]),
});
export type Chapter = z.infer<typeof chapterSchema>;

const gallerySchema = z
  .object({
    hero: z
      .object({
        eyebrow: z.string().max(60).default(""),
        lineOne: z.string().max(120).default(""),
        lineTwo: z.string().max(120).default(""),
        blurb: z.string().max(500).default(""),
      })
      .prefault({}),
    chapters: z.array(chapterSchema).max(40).default([]),
    outro: z
      .object({
        lineOne: z.string().max(120).default(""),
        lineTwo: z.string().max(120).default(""),
        aside: z.string().max(300).default(""),
        backLabel: z.string().max(60).default(""),
      })
      .prefault({}),
  })
  .prefault({});

/* ------------------------------------------------------------------ *
 * MODERN TEMPLATE
 * ------------------------------------------------------------------ */

/**
 * The modern template's own copy.
 *
 * ## Why images are not here
 *
 * Deliberately no media fields. The modern template's photographs are the same
 * `home.moments` the classic template uses, mapped by `modernMemories` in
 * `derive.ts`. Storing a second copy of them would mean the two templates could
 * disagree, and — the reason this matters — switching `template` mid-config
 * would strand every upload in whichever section was not currently on screen.
 *
 * One list of images, two ways of presenting it. Text is template-specific
 * because the layouts genuinely differ: "Open the gallery" suits the classic
 * hero and would be wrong in the modern orbit.
 */
const modernSchema = z
  .object({
    hero: z
      .object({
        eyebrow: z.string().max(60).default(""),
        /** Three lines, so the middle can carry the serif accent. */
        lines: z
          .array(z.string().max(60))
          .min(1)
          .max(3)
          .default(["", "", ""]),
        subline: z.string().max(300).default(""),
        ctaLabel: z.string().max(40).default(""),
        /** Label for the in-page archive link. */
        scrollHint: z.string().max(40).default(""),
      })
      .prefault({}),

    /** The note behind the hero's primary button. */
    letter: z
      .object({
        kicker: z.string().max(60).default(""),
        text: z.string().max(2000).default(""),
        signoff: z.string().max(200).default(""),
      })
      .prefault({}),

    strip: z
      .object({
        eyebrow: z.string().max(60).default(""),
        heading: z.string().max(120).default(""),
        note: z.string().max(200).default(""),
      })
      .prefault({}),

    archive: z
      .object({
        eyebrow: z.string().max(60).default(""),
        heading: z.string().max(120).default(""),
        note: z.string().max(200).default(""),
        ctaLabel: z.string().max(40).default(""),
      })
      .prefault({}),

    gallery: z
      .object({
        eyebrow: z.string().max(60).default(""),
        lines: z
          .array(z.string().max(60))
          .min(1)
          .max(3)
          .default(["", "", ""]),
        blurb: z.string().max(500).default(""),
        backLabel: z.string().max(40).default(""),
      })
      .prefault({}),

    closing: z
      .object({
        heading: z.string().max(200).default(""),
        copy: z.string().max(500).default(""),
        signature: z.string().max(80).default(""),
      })
      .prefault({}),
  })
  .prefault({});

/* ------------------------------------------------------------------ *
 * EDITORIAL TEMPLATE
 * ------------------------------------------------------------------ */

/**
 * The editorial template's copy — and only the personal parts of it.
 *
 * ## Why there is no heading field here
 *
 * The editorial layout is a magazine, and a magazine's section headings —
 * "one person / one issue", "contents", "from the editor", "figures of us." —
 * are set by the publication, not by its writer. They are chrome, and they
 * live in the components. The fields below are the words that are
 * unmistakably somebody's: the person the issue is about, the pull-quote, and
 * the editor's letter.
 *
 * ## Why images are not here
 *
 * Same as the modern template: photographs are `home.moments`, read through
 * `editorialMoments` in `derive.ts`. Storing a second list would let the two
 * disagree, and — the reason this matters — switching `template` mid-config
 * would strand every upload in whichever section was not currently on
 * screen. A moment's `date` becomes the dateline, its `caption` becomes the
 * story headline, and its `secret` becomes the note under the figure.
 */
const editorialSchema = z
  .object({
    /**
     * The person the issue is about, printed in the masthead. Left blank it
     * falls back to the site name, so an author who only filled one field in
     * still gets a named issue.
     */
    person: z.string().max(60).default(""),
    /** The pull-quote between the stories, set very large. Clearing it hides the section. */
    quote: z.string().max(300).default(""),
    /** The editor's letter. A few short paragraphs, split on newlines when rendered. */
    letter: z.string().max(4000).default(""),
  })
  .prefault({});

/* ------------------------------------------------------------------ *
 * SITE
 * ------------------------------------------------------------------ */

/** Which layouts the renderer knows how to draw. */
export const TEMPLATE_IDS = ["editorial", "modern", "scrapbook"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/**
 * Which template renders the site.
 *
 * Separate from `theme` on purpose: a template is layout and copy. Only the
 * modern template reads the shared colour presets; editorial and scrapbook
 * carry their own palettes, so `theme` is stored but unused there.
 *
 * Written as `string` -> transform rather than `z.enum` so that a config saved
 * before templates existed keeps parsing, and so an id this build no longer
 * knows falls back to editorial instead of rejecting the whole site. That
 * mirrors how `theme` is stored, and the reasoning is the same: an unknown
 * value should cost the author their choice, never their page.
 *
 * The fallback is editorial, not an id anyone stored: it is the replacement
 * for the retired classic layout, so a config saved with `template: "classic"`
 * renders the design that took over rather than failing loudly.
 */
const templateSchema = z
  .string()
  .default("editorial")
  .catch("editorial")
  .transform((value): TemplateId =>
    (TEMPLATE_IDS as readonly string[]).includes(value) ? (value as TemplateId) : "editorial",
  );

export const siteSchema = z.object({
  version: z.literal(1).default(1),
  /** URL segment. Generated once, then treated as immutable. */
  slug: z.string().regex(/^[a-z0-9-]+$/, "lowercase letters, digits and hyphens"),

  /** Preset id from `themes.ts`. Kept as a string so that adding a preset later
   *  cannot invalidate an existing config; `resolveTheme` falls back safely.
   *  Only the modern template renders from it. */
  theme: z.string().min(1),

  /** Which template renders the site. Independent of `theme`. */
  template: templateSchema,

  /** Only the site name lives here. Nav labels are chrome and belong to the
   *  components, not the config. */
  identity: z
    .object({
      name: z.string().max(60).default(""),
    })
    .prefault({}),

  home: homeSchema,
  gallery: gallerySchema,

  /**
   * The modern template's copy. Present on every config, whatever the template,
   * so switching `template` back and forth never loses a draft.
   */
  modern: modernSchema,

  /**
   * The editorial template's copy. Present on every config, whatever the
   * template, for the same reason `modern` is: a draft never loses its words
   * because a different layout was briefly chosen.
   */
  editorial: editorialSchema,
});

export type Site = z.infer<typeof siteSchema>;

/* ------------------------------------------------------------------ *
 * SUBMISSION CHECKS
 * ------------------------------------------------------------------ */

/**
 * What a site must have before it can go live.
 *
 * Separate from the schema on purpose. The schema describes what a *draft* may
 * look like — anything goes, including almost nothing. This describes what a
 * *submitted* site must have, so the review step can reject an empty one
 * without the schema having to be strict all the way through.
 */
export type Issue = {
  /** Dotted path to the offending field, for the dashboard to highlight. */
  path: string;
  message: string;
};

/**
 * One requirement a site has to meet, and whether it currently meets it.
 *
 * Split out from `findSubmissionIssues` so the dashboard can report progress as
 * well as problems. "19 of 32 done" needs the 32, and a list of failures alone
 * cannot say what the total was — so the total and the failures come from the
 * same walk and cannot disagree.
 */
export type SubmissionCheck = {
  /** Dotted path to the offending field, for the dashboard to highlight. */
  path: string;
  /** What is wrong with it, if anything. */
  message: string;
  /** True when the site satisfies this requirement. */
  ok: boolean;
};

/**
 * Every requirement the current site is measured against.
 *
 * Flat, and one entry per requirement, so the count of entries is the count of
 * things to do. An "at least one moment" requirement is present whether or not
 * there are moments — it passes once there are — so the total grows as content
 * is added and the meter can honestly say that adding a moment adds work.
 *
 * The alternative, counting only what is currently broken, cannot produce a
 * progress figure at all: the denominator would move every time a field was
 * fixed, and a bar whose denominator is the thing it is measuring is not a
 * bar.
 */
export function submissionChecks(site: Site): SubmissionCheck[] {
  const checks: SubmissionCheck[] = [];
  const need = (path: string, value: string, label: string) => {
    checks.push({
      path,
      message: `${label} is empty`,
      ok: value.trim().length > 0,
    });
  };

  need("identity.name", site.identity.name, "Site name");
  need("home.hero.lines.0", site.home.hero.lines[0] ?? "", "First headline line");
  need("home.hero.subline", site.home.hero.subline, "Hero subtitle");
  need("home.hero.primaryCta", site.home.hero.primaryCta, "Main button label");

  checks.push({
    path: "home.moments",
    message: "Add at least one moment",
    ok: site.home.moments.length > 0,
  });

  // Every media entry needs a reachable URL. A dropped upload leaves a null
  // publicId and an empty url, which would render as a broken frame.
  const checkMedia = (media: Media, path: string) => {
    checks.push({
      path: `${path}.url`,
      message: "File is missing",
      ok: media.url.trim().length > 0,
    });
  };

  site.home.moments.forEach((m, i) => {
    need(`home.moments.${i}.caption`, m.caption, "Moment caption");
    checkMedia(m.image, `home.moments.${i}.image`);
  });

  checks.push({
    path: "gallery.chapters",
    message: "Add at least one chapter",
    ok: site.gallery.chapters.length > 0,
  });

  site.gallery.chapters.forEach((chapter, ci) => {
    need(`gallery.chapters.${ci}.title`, chapter.title, "Chapter title");
    checks.push({
      path: `gallery.chapters.${ci}`,
      message: `"${chapter.title || `Chapter ${ci + 1}`}" has no films or photographs`,
      ok: chapter.films.length > 0 || chapter.stills.length > 0,
    });
    chapter.films.forEach((film, fi) => {
      need(`gallery.chapters.${ci}.films.${fi}.title`, film.title, "Film title");
      checkMedia(film.src, `gallery.chapters.${ci}.films.${fi}.src`);
    });
    chapter.stills.forEach((still, si) => {
      checkMedia(still.src, `gallery.chapters.${ci}.stills.${si}.src`);
    });
  });

  return checks;
}

export function findSubmissionIssues(site: Site): Issue[] {
  return submissionChecks(site)
    .filter((check) => !check.ok)
    .map(({ path, message }) => ({ path, message }));
}