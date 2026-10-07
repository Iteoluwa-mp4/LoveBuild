import { type Media, siteSchema, type Site } from "./schema";
import { defaultThemeId } from "./themes";

/**
 * The demo site's slug.
 *
 * Exported so the routes, the dashboard and the loader agree without repeating
 * the literal. Step 4b replaces this with whatever the new site is called.
 */
export const SEED_SLUG = "hers";

/**
 * An empty site. Only the slug and theme are required — every other field has a
 * default in the schema, so a config can exist before any content is written.
 *
 * Used by the tests and by `createDraft`'s counterpart cases. A real new site
 * starts from `createDraft`, which seeds the sample copy.
 */
export function emptySite(slug: string): Site {
  return siteSchema.parse({ slug, theme: defaultThemeId });
}

/**
 * What a brand-new site starts as: the sample copy, under a new slug.
 *
 * Starting populated rather than empty is deliberate. Asking someone to write a
 * letter before they have seen the shape of the thing is how you get a blank
 * form and a disappointed user — with content in place, the first edit is "change
 * her name" instead of "begin".
 *
 * Nothing personal is inherited. Every line is instructional, and
 * `findSampleIssues` flags whatever the owner has not replaced, so placeholder
 * wording cannot pass as something a person wrote.
 */
export function createDraft(slug: string): Site {
  const site = sample();
  return { ...site, slug };
}

/* ------------------------------------------------------------------ *
 * SAMPLE CONTENT
 * ------------------------------------------------------------------ */

/**
 * Placeholder copy, so the layout can be seen with something in it.
 *
 * This is deliberately NOT one person's birthday site. That content was removed,
 * and putting equivalent wording back would defeat the point. What lives here is
 * instructional instead — each line says what belongs in that slot, which is more
 * use to whoever fills it in than lorem ipsum and far more use than the original.
 *
 * Media slots are deliberately left empty so the placeholders show. That is the
 * point of the sample: you can see where a photo or a video goes without anyone
 * else's picture ending up in the repository.
 *
 * `findSampleText` compares against this, so anything left untouched is flagged
 * rather than quietly shipped.
 */
function sample(): Site {
  return siteSchema.parse({
    slug: SEED_SLUG,
    theme: defaultThemeId,

    identity: { name: "Sample Site" },

    home: {
      hero: {
        lines: ["Your headline here", "A second line", "And a third"],
        subline:
          "One or two sentences about why this is for her. Keep it short — it is the first thing she reads.",
        primaryCta: "Open the gallery",
        secondaryCta: "Keep scrolling",
      },

      moments: [
        {
          id: cryptoId(),
          tag: "",
          date: "",
          caption: "A caption she reads before she taps",
          secret: "The hidden message, revealed when she taps the photo.",
          image: emptyMedia(),
        },
        {
          id: cryptoId(),
          tag: "",
          date: "",
          caption: "A second moment",
          secret: "Something only the two of you would get.",
          image: emptyMedia(),
        },
      ],

      quote: {
        text: "Write the quote here. The last sentence is highlighted for you automatically.",
        truth: [
          "Why this matters",
          "",
          "This is the longer letter, hidden behind a button. A few short paragraphs is plenty — it is the part she will read twice.",
        ].join("\n"),
        author: "Your name",
        authorSub: "A small line under your name",
        verdictLabel: "Verdict:",
        verdictValue: "10 / 10",
        toggleReveal: "Show the letter",
        toggleBack: "Back to the quote",
      },

      footer: {
        heading: "The real proof is in the videos.",
        subline: "Press play and relive it.",
        ctaLabel: "Watch the gallery",
        cards: [
          { id: cryptoId(), tag: "Clip 01", quote: "A short line about this clip." },
          { id: cryptoId(), tag: "Clip 02", quote: "Another one-liner." },
          { id: cryptoId(), tag: "Clip 03", quote: "And a third." },
        ],
      },
    },

    gallery: {
      hero: {
        eyebrow: "The gallery",
        lineOne: "Every video worth",
        lineTwo: "keeping.",
        blurb: "A line introducing the reel. Optional, but it gives the page an opening.",
      },

      chapters: [
        {
          id: cryptoId(),
          label: "",
          title: "First chapter",
          blurb: "Name this part of the story. Chapters keep everything in order.",
          films: [
            {
              id: cryptoId(),
              title: "A video from this chapter",
              note: "The line beside the clip. Write it to her, not about her.",
              src: emptyMedia(),
            },
          ],
          stills: [{ id: cryptoId(), caption: "A photograph caption", src: emptyMedia() }],
        },
        {
          id: cryptoId(),
          label: "",
          title: "Another chapter",
          blurb: "Add as many as you like — they appear in this order.",
          films: [
            {
              id: cryptoId(),
              title: "And another video",
              note: "Each clip gets its own title and note.",
              src: emptyMedia(),
            },
          ],
          stills: [],
        },
      ],

      outro: {
        lineOne: "That's the reel.",
        lineTwo: "For now.",
        aside: "A small line under the closing words.",
        backLabel: "Back to the beginning",
      },
    },
  });
}

/** The demo site, for screenshots and for seeing the layout populated. */
export function defaultSite(): Site {
  return sample();
}

/* ------------------------------------------------------------------ *
 * MEDIA FACTORY
 * ------------------------------------------------------------------ */

/**
 * An empty media slot.
 *
 * `url: ""` rather than a path: the template renders a placeholder for an empty
 * slot, and anything else would either 404 or quietly keep someone's photograph
 * in the repository.
 */
export function emptyMedia(): Media {
  return {
    id: cryptoId(),
    publicId: null,
    url: "",
    alt: "",
    caption: "",
    width: null,
    height: null,
    durationMs: null,
  };
}

/* ------------------------------------------------------------------ *
 * SAMPLE TEXT DETECTION
 * ------------------------------------------------------------------ */

/** Path to sample value, for every non-empty string in the sample. */
let sampleIndex: Map<string, string> | null = null;

/**
 * Fields that are never "placeholder" no matter what they hold.
 *
 * `theme` and `slug` are settings, not copy. Ids are generated per site. All
 * are identical on a blank site and the sample, so comparing them would report
 * every new site as still holding sample text — not a useful warning, and once the
 * list cries wolf it stops being read.
 */
const NOT_SAMPLE = new Set(["slug", "theme", "version", "id", "publicId"]);

function getSampleIndex(): Map<string, string> {
  if (sampleIndex) return sampleIndex;

  const index = new Map<string, string>();
  const walk = (node: unknown, path: string) => {
    if (typeof node === "string") {
      if (node.trim() && !NOT_SAMPLE.has(path)) index.set(path, node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}.${i}`));
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) walk(value, path ? `${path}.${key}` : key);
    }
  };

  walk(sample(), "");
  sampleIndex = index;
  return index;
}

/**
 * True when a field still holds its sample wording.
 *
 * The point is that placeholder text cannot quietly ship. Someone who fills in
 * the hero but forgets the closing section should be told, rather than handing
 * over a site with "Press play and relive it" written by a developer.
 */
export function isSampleText(path: string, value: unknown): boolean {
  if (typeof value !== "string") return false;
  const sample = getSampleIndex().get(path);
  return sample !== undefined && value.trim() === sample;
}

/** Every path still holding sample wording, for the dashboard to flag. */
export function findSampleText(site: Site): string[] {
  const index = getSampleIndex();
  const found: string[] = [];

  for (const [path, expected] of index) {
    // Read by path so this works without importing the path helpers here.
    let cursor: unknown = site;
    for (const segment of path.split(".")) {
      if (cursor === null || cursor === undefined || typeof cursor !== "object") {
        cursor = undefined;
        break;
      }
      cursor = (cursor as Record<string, unknown>)[segment];
    }

    if (typeof cursor === "string" && cursor.trim() === expected) found.push(path);
  }

  return found;
}

/**
 * A human label for a sample-text path.
 *
 * The leaf key is readable for most fields but not all of them. Two cases need
 * handling, and both are handled by shape rather than by listing every path:
 *
 *   - A numeric leaf is an array index — `home.hero.lines.0` is "0", which tells
 *     the person nothing. Falls back to the parent key plus the position.
 *   - `lineOne`, `primaryCta` and friends read as jargon once camelCase is split.
 *     Those are named explicitly.
 *
 * Generic handling matters because array paths are unbounded: moments and
 * chapters are added at runtime, and a hand-kept list would report them as
 * "caption still has the placeholder text" with no indication which one.
 */
const SAMPLE_LABELS: Record<string, string> = {
  "home.hero.lines.0": "Headline, line 1",
  "home.hero.lines.1": "Headline, line 2",
  "home.hero.lines.2": "Headline, line 3",
  "home.hero.subline": "Hero subtitle",
  "home.hero.primaryCta": "Main button label",
  "home.hero.secondaryCta": "Second button label",
  "gallery.hero.lineOne": "Gallery intro, line 1",
  "gallery.hero.lineTwo": "Gallery intro, line 2",
  "gallery.outro.lineOne": "Outro, line 1",
  "gallery.outro.lineTwo": "Outro, line 2",
  "gallery.outro.backLabel": "Back button",
  "gallery.hero.eyebrow": "Gallery label",
};

/** How an array element should be described: "Moment 2 caption", not "2 caption". */
const ARRAY_LABELS: Record<string, string> = {
  lines: "Headline",
  moments: "Moment",
  chapters: "Chapter",
  films: "Video",
  stills: "Photo",
  cards: "Card",
};

export function sampleTextLabel(path: string): string {
  const named = SAMPLE_LABELS[path];
  if (named) return named;

  const parts = path.split(".");

  // Two shapes, because config has both:
  //   home.hero.lines.0        an array of plain strings — the index is the leaf
  //   home.moments.0.caption   an array of objects   — the index is above the leaf
  const leafIsIndex = /^\d+$/.test(parts.at(-1) ?? "");
  const parentIsIndex = parts.length >= 3 && /^\d+$/.test(parts.at(-2) ?? "");

  if (leafIsIndex || parentIsIndex) {
    const index = Number(leafIsIndex ? parts.at(-1) : parts.at(-2));
    const collection = parts.at(leafIsIndex ? -2 : -3) ?? "";
    const known = ARRAY_LABELS[collection];
    const item = known ?? leafName(collection);
    const position = `${item} ${index + 1}`;
    return parentIsIndex && !leafIsIndex ? `${position} ${leafName(parts.at(-1)!)}` : position;
  }

  return leafName(parts.at(-1) ?? path);
}

/** `primaryCta` -> "Primary cta". Capitalised, split on the camel humps. */
function leafName(leaf: string): string {
  return leaf.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function cryptoId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2, 10)}`;
}
