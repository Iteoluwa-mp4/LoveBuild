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
 * Placeholder copy, so the layout can be seen with something in it — and so
 * whoever fills it in has something to start from.
 *
 * ## What this copy is for
 *
 * Not lorem ipsum, and not field names. Every line is written as though someone
 * who actually loves her were saying it, because that is the only version of
 * this that helps. "Add your quote here" tells the reader nothing except that a
 * quote belongs in the slot; a real sentence tells them the *tone* to aim for,
 * roughly how long it should be, and that the layout will hold a whole thought
 * rather than three words.
 *
 * It is written about the act of keeping a record of someone — which is what
 * this site is — rather than about any particular relationship. That is
 * deliberate. Earlier revisions used one person's real birthday copy, and it had
 * to be removed: the next person should not inherit a stranger's words, and a
 * template that ships someone else's love letter is worse than one that ships
 * nothing.
 *
 * Media slots are left empty so the placeholders show. You can see where a photo
 * or a video goes without anyone's picture ending up in the repository.
 *
 * `findSampleText` compares against this, so anything left untouched is flagged
 * rather than quietly shipped. The wording is deliberately specific for that
 * reason — a real person's line will not read "Ordinary Tuesday. Nothing
 * happened at all.", so it can never be mistaken for the placeholder.
 */
/**
 * Exported so the standalone template previews can render against it.
 *
 * `/templates/modern` is a development surface for the modern layout rather
 * than a second copy of the site, and it needs a config to render. The seed is
 * the right one: it is already instructional copy with empty media slots, which
 * is exactly what a layout preview wants to show.
 */
export function sample(): Site {
  return siteSchema.parse({
    slug: SEED_SLUG,
    theme: defaultThemeId,

    identity: { name: "Her name" },

    home: {
      hero: {
        /*
          Three lines because the layout reveals them in sequence and the last
          one carries the accent. The rhythm — two short, then a longer one — is
          the thing worth borrowing from; a real site usually wants two lines,
          and the third can simply be left blank.
        */
        lines: ["Annoyingly,", "impossibly,", "the favourite one."],
        subline:
          "Every photograph, every ridiculous moment, every reason I could not think of a better use of a weekend — all of it in one place, because you deserve better than a camera roll.",
        primaryCta: "Open the gallery",
        secondaryCta: "Keep scrolling",
      },

      moments: [
        {
          id: cryptoId(),
          tag: "",
          date: "",
          /*
            The caption is what she reads before tapping; the secret is what is
            underneath. Written as a matched pair so the two halves demonstrate
            the relationship between them — a public prompt and a private aside.
          */
          caption: "Do you remember the night we missed the last train?",
          secret:
            "We blamed the timetable. Neither of us mentioned that neither of us wanted to go home yet.",
          image: emptyMedia(),
        },
        {
          id: cryptoId(),
          tag: "",
          date: "",
          caption: "You, mid-argument, holding a cup of cold coffee.",
          secret:
            "You were completely wrong, by the way. You are still completely wrong about most things. I would not trade a single one of them.",
          image: emptyMedia(),
        },
        {
          id: cryptoId(),
          tag: "",
          date: "",
          caption: "The first time you fell asleep on my shoulder.",
          secret:
            "I did not move for two hours. My arm went completely numb and I have never once minded.",
          image: emptyMedia(),
        },
        {
          id: cryptoId(),
          tag: "",
          date: "",
          caption: "Ordinary Tuesday. Nothing happened at all.",
          secret:
            "That is why it is here. Most of what I love about you is nothing happening.",
          image: emptyMedia(),
        },
      ],

      quote: {
        text: "You are ridiculous, and loud, and you have never once apologised for either.",
        truth: [
          "Why I made this",
          "",
          "There is a version of this letter that is all the big things — the year we met, the trip we took, the night I realised. I have written that letter about four times and it keeps coming out sounding like a wedding speech, which is not what this is.",
          "",
          "So this is the other version. The one made of ordinary afternoons and the specific things you do when you think nobody is watching. You hum when you cook and you always hum the wrong version. You text me back immediately when you say you will be late. You keep a photograph of my terrible haircut on your phone and have never once been asked to delete it.",
          "",
          "None of that is remarkable. That is rather the point. Most people only ever get the dramatic version of each other, and I have been lucky enough to also get the Tuesday one.",
          "",
          "I am not going anywhere, and you were never going to get rid of me anyway.",
        ].join("\n"),
        author: "Me, obviously",
        authorSub: "Written badly",
        verdictLabel: "Verdict:",
        verdictValue: "10 / 10",
        toggleReveal: "Read the rest",
        toggleBack: "Back to the quote",
      },

      footer: {
        heading: "The real proof is in the videos.",
        subline: "Press play. I have been warned about the sound.",
        ctaLabel: "Watch the gallery",
        cards: [
          {
            id: cryptoId(),
            tag: "Clip 01",
            quote: "Evidence of you singing in the car, entirely convinced I cannot hear you.",
          },
          {
            id: cryptoId(),
            tag: "Clip 02",
            quote: "The great microwave argument, settled on evidence neither of us had.",
          },
          {
            id: cryptoId(),
            tag: "Clip 03",
            quote: "Why you have never once agreed to be filmed. I remain baffled.",
          },
        ],
      },
    },

    gallery: {
      hero: {
        eyebrow: "The gallery",
        lineOne: "Every video",
        lineTwo: "worth keeping.",
        blurb:
          "This is the part that made the whole thing worth building. A few clips, a few photographs, and one evening of me being told to stop filming.",
      },

      chapters: [
        {
          id: cryptoId(),
          label: "",
          title: "The first one",
          blurb: "Where it starts, and why I could not stop talking about it.",
          films: [
            {
              id: cryptoId(),
              title: "You, on the platform, not noticing the photo",
              note:
                "I took about nine of these. This is the one where you are actually looking at something, which is why it is the one I kept.",
              src: emptyMedia(),
            },
            {
              id: cryptoId(),
              title: "The terrible first toast",
              note:
                "You said 'to the best years of my life' and I choked on my drink laughing. Worth the cough.",
              src: emptyMedia(),
            },
          ],
          stills: [
            { id: cryptoId(), caption: "The receipt from that first dinner", src: emptyMedia() },
            { id: cryptoId(), caption: "Proof that this was the good idea", src: emptyMedia() },
          ],
        },
        {
          id: cryptoId(),
          label: "",
          title: "Just us",
          blurb: "The ones where nobody else was there to make it awkward.",
          films: [],
          stills: [
            { id: cryptoId(), caption: "A completely ordinary morning", src: emptyMedia() },
            { id: cryptoId(), caption: "You, asleep, not to be shared", src: emptyMedia() },
            { id: cryptoId(), caption: "The view from the wrong side of the train", src: emptyMedia() },
          ],
        },
        {
          id: cryptoId(),
          label: "",
          title: "The ridiculous one",
          blurb: "I will not be elaborating. You were there.",
          films: [
            {
              id: cryptoId(),
              title: "Explain the hat",
              note:
                "It is not an explanation, it is a list of increasingly worse excuses. You are still wearing it in the background of Clip 04.",
              src: emptyMedia(),
            },
          ],
          stills: [
            { id: cryptoId(), caption: "The hat, in its natural habitat", src: emptyMedia() },
          ],
        },
      ],

      outro: {
        lineOne: "That is the lot.",
        lineTwo: "For now.",
        aside: "Which is not a thing I would have said six years ago.",
        backLabel: "Back to the beginning",
      },
    },

    /*
      The modern template's copy, seeded the same way.

      Instructional for the same reason the rest of this sample is, and with the
      same caveat: `modern.hero.lines` is an array of three because the middle
      one renders in the serif accent, so it is stored as three separate strings
      rather than one line the layout would have to split.

      No media here. The photographs come from `home.moments` above, which is the
      point — one list, two templates, so switching between them keeps every
      upload. Seeding a second set here would quietly reintroduce the split this
      is meant to avoid.
    */
    modern: {
      hero: {
        /*
          Three lines, and the middle one is what renders in the serif accent —
          so the rhythm to copy is short, word, short. "You are / still / my
          favourite place" is deliberately plain; the layout is doing the work.
        */
        eyebrow: "a small universe, for one person",
        lines: ["You are", "still", "my favourite place."],
        subline:
          "A constellation of the moments, the frequencies, and the very quiet magic that make us us. Nothing here is urgent. Take your time with it.",
        ctaLabel: "Open your note",
        scrollHint: "Drift through",
      },
      letter: {
        kicker: "Private transmission / unsealed",
        text: [
          "I started this about four times and stopped, because every version kept turning into a list of big moments. The year we met. The trip. The night I finally knew.",
          "",
          "But that is not the part I actually miss. What I miss is Tuesdays. You, complaining about the cold, then putting your cold feet on my legs anyway. The way you say a whole story with your hands and then deny doing it.",
          "",
          "So — this is the version that is mostly nothing happening. I think it is better.",
          "",
          "You make ordinary days feel like they are hiding something. Thank you for that.",
        ].join("\n"),
        signoff: "Yours, in every timeline",
      },
      strip: {
        eyebrow: "Contact sheet",
        heading: "Pick one. Stay a while.",
        note: "Drag the sphere, or tap any frame.",
      },
      archive: {
        eyebrow: "Full archive",
        heading: "A few favourite signals.",
        note: "Every one, with what actually happened.",
        ctaLabel: "Open the album",
      },
      gallery: {
        eyebrow: "The album",
        lines: ["Every", "orbit", "we ever ran"],
        blurb:
          "All of it, in order, with the parts I would have forgotten otherwise. There is no timer on this page.",
        backLabel: "Return home",
      },
      closing: {
        heading: "Same team. Same orbit.",
        copy: "No matter how far the signal travels, it always finds its way back to you.",
        signature: "with all my heart",
      },
    },

    /*
      The editorial template's copy, seeded the same way as the modern one:
      instructional, generic enough that nobody inherits a stranger's words,
      and specific enough that sample detection can flag what is left alone.

      Only the personal parts are here because the headings are the
      publication's: they live in the components, and there is deliberately no
      field to change them. No media either — the photographs come from
      `home.moments` above, through `editorialMoments` in `derive.ts`.
    */
    editorial: {
      person: "for you",
      quote: "The best part of every place is finding you there.",
      letter: [
        "You are the story I never get tired of rereading.",
        "",
        "Thank you for the brave beginnings, the tiny rituals, and every version of ordinary that became ours. If this issue has a thesis, it is simple: life is more itself with you in it.",
      ].join("\n"),
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
 * `theme`, `template` and `slug` are settings, not copy. Ids are generated per
 * site. All are identical on a blank site and the sample, so comparing them
 * would report every new site as still holding sample text — not a useful
 * warning, and once the list cries wolf it stops being read.
 */
const NOT_SAMPLE = new Set(["slug", "theme", "template", "version", "id", "publicId"]);

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
 * over a site with placeholder wording written by a developer.
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
