import { describe, expect, it } from "vitest";
import {
  chapterLabel,
  ctaTarget,
  emphasisParts,
  findIssues,
  hasContent,
  momentTag,
  modernMemories,
  scrapbookMemories,
  uploadItems,
  readiness,
  siteOutline,
  uploadProgress,
  visibleBlocks,
} from "../derive";
import { defaultSite, emptySite } from "../default";
import { isInternalPageLink, momentsAnchor, sitePaths } from "../paths";
import type { Site } from "../schema";

/** A minimal site with only the fields a test cares about. */
function siteWith(overrides: Partial<Site> = {}): Site {
  return { ...emptySite("t"), ...overrides };
}

/**
 * The modern template's view of the site's photographs.
 *
 * This mapping is the whole reason a template switch is safe, so it is tested
 * on the config rather than trusted to the UI.
 */
describe("modernMemories", () => {
  function siteWithMoments(moments: Site["home"]["moments"]): Site {
    const site = emptySite("t");
    site.home.moments = moments;
    return site;
  }

  const uploaded = {
    id: "m1",
    tag: "first orbit",
    date: "Oct 14",
    caption: "The night it changed.",
    secret: "A longer line she reads twice.",
    image: {
      id: "i1",
      publicId: null,
      url: "https://example.test/a.jpg",
      alt: "",
      caption: "",
      width: null,
      height: null,
      durationMs: null,
    },
  };

  it("maps a moment's fields onto the modern shape", () => {
    const [memory] = modernMemories(siteWithMoments([uploaded]));
    expect(memory.label).toBe("first orbit");
    expect(memory.caption).toBe("The night it changed.");
    expect(memory.note).toBe("A longer line she reads twice.");
    expect(memory.image).toBe("https://example.test/a.jpg");
  });

  /**
   * A moment with no custom tag still needs a name for the strip and the index,
   * so the position-derived fallback is what keeps a slot from rendering blank.
   */
  it("derives a label when the moment has no tag", () => {
    const [memory] = modernMemories(siteWithMoments([{ ...uploaded, tag: "" }]));
    expect(memory.label).toBe("Moment 01");
  });

  /**
   * The reason this function exists rather than a filter: an unfilled slot still
   * has to appear, or an author mid-upload would see a slice silently vanish.
   */
  it("keeps a slot with no photo, using a generated frame", () => {
    const [memory] = modernMemories(siteWithMoments([{ ...uploaded, image: { ...uploaded.image, url: "" } }]));
    expect(memory.image.startsWith("data:image/svg+xml,")).toBe(true);
  });

  it("returns nothing for a site with no moments, rather than throwing", () => {
    expect(modernMemories(emptySite("t"))).toEqual([]);
  });
});

/**
 * The scrapbook used to render six generated photographs and ignore the site
 * entirely, so choosing it swapped the author's work for a demo. This mapping
 * is what makes it a template rather than a fixed picture, so it is tested on
 * the config in the same way `modernMemories` is.
 */
describe("scrapbookMemories", () => {
  function siteWithMoments(moments: Site["home"]["moments"]): Site {
    const site = emptySite("t");
    site.home.moments = moments;
    return site;
  }

  const uploaded = {
    id: "m1",
    tag: "the first one",
    date: "Oct 14",
    caption: "We kept the ticket.",
    secret: "You kept the flowers.",
    image: {
      id: "i1",
      publicId: null,
      url: "https://example.test/a.jpg",
      alt: "",
      caption: "",
      width: null,
      height: null,
      durationMs: null,
    },
  };

  it("maps a moment's fields onto the scrapbook shape", () => {
    const [memory] = scrapbookMemories(siteWithMoments([uploaded]));
    expect(memory.caption).toBe("We kept the ticket.");
    expect(memory.note).toBe("You kept the flowers.");
    expect(memory.date).toBe("Oct 14");
    expect(memory.image).toBe("https://example.test/a.jpg");
  });

  /**
   * The caption is printed on the white border, which is the card. An empty
   * caption would leave a blank strip where every other card has handwriting,
   * so the position-derived label stands in — the same fallback the modern
   * template uses for its strip label.
   */
  it("derives a caption when the moment has none, so no border is blank", () => {
    const [memory] = scrapbookMemories(
      siteWithMoments([{ ...uploaded, caption: "   ", tag: "" }]),
    );
    expect(memory.caption).toBe("Moment 01");
  });

  /**
   * The tag still wins over the position. "the first one" is handwriting the
   * author already wrote, so replacing it with "Moment 01" would throw away
   * real copy in order to fill a gap that was not there.
   */
  it("prefers the moment's tag over its position when the caption is empty", () => {
    const [memory] = scrapbookMemories(siteWithMoments([{ ...uploaded, caption: "" }]));
    expect(memory.caption).toBe("the first one");
  });

  it("keeps a slot with no photo, using a generated frame", () => {
    const [memory] = scrapbookMemories(
      siteWithMoments([{ ...uploaded, image: { ...uploaded.image, url: "" } }]),
    );
    expect(memory.image.startsWith("data:image/svg+xml,")).toBe(true);
  });

  /**
   * Tilt and tape are the whole reason a grid of cards reads as scattered
   * rather than aligned — and they are recomputed on every render. If they
   * were not a pure function of position, every state change would re-lay the
   * page under the reader.
   */
  it("gives each position a stable tilt and tape", () => {
    const site = siteWithMoments([uploaded, { ...uploaded, id: "m2" }, { ...uploaded, id: "m3" }]);
    const once = scrapbookMemories(site);
    const twice = scrapbookMemories(site);
    expect(once).toEqual(twice);
    for (const memory of once) {
      expect(typeof memory.tilt).toBe("number");
      expect(["top-left", "top-right", "top-center", "none"]).toContain(memory.tape);
    }
    // Not all identical, or the "scattered" look is a fiction.
    expect(new Set(once.map((memory) => memory.tilt)).size).toBeGreaterThan(1);
  });

  it("returns nothing for a site with no moments, rather than throwing", () => {
    expect(scrapbookMemories(emptySite("t"))).toEqual([]);
  });
});

describe("hasContent", () => {
  it("treats whitespace as absent", () => {
    expect(hasContent("")).toBe(false);
    expect(hasContent("   ")).toBe(false);
    expect(hasContent("\n\t ")).toBe(false);
  });

  it("accepts anything with a real character", () => {
    expect(hasContent("a")).toBe(true);
    expect(hasContent("  a  ")).toBe(true);
    expect(hasContent("0")).toBe(true);
  });

  it("tolerates missing values", () => {
    expect(hasContent(undefined)).toBe(false);
    expect(hasContent(null)).toBe(false);
  });
});

describe("derived labels", () => {
  it("numbers moments when no tag was given", () => {
    expect(momentTag("", 0)).toBe("Moment 01");
    expect(momentTag("   ", 4)).toBe("Moment 05");
  });

  it("uses a custom tag when one was given", () => {
    expect(momentTag("Anniversary", 0)).toBe("Anniversary");
    expect(momentTag("  First trip  ", 3)).toBe("First trip");
  });

  it("numbers chapters when no label was given", () => {
    expect(chapterLabel("", 0)).toBe("01");
    expect(chapterLabel("", 11)).toBe("12");
  });

  it("derives the same numbers the seed content used to hardcode", () => {
    const site = defaultSite();
    expect(site.home.moments.every((m) => m.tag === "")).toBe(true);
    expect(site.gallery.chapters.every((c) => c.label === "")).toBe(true);
    // Four moments and three chapters, so the strip and the gallery both have
    // enough content to show the layout properly.
    expect(site.home.moments).toHaveLength(4);
    expect(site.gallery.chapters).toHaveLength(3);
  });
});

describe("ctaTarget", () => {
  /**
   * Regression. `ctaTarget` used to accept an optional `basePath` and ignore it
   * for the gallery, returning a bare `/gallery`. That was right when sites lived
   * at the root and wrong the moment they moved to `/s/:slug`, and it failed by
   * rendering the not-found screen rather than by complaining — so the test
   * below is specifically that every path stays under the site's own base.
   */
  it("keeps the gallery path under the site's base path", () => {
    expect(ctaTarget("gallery", "/s/hers")).toBe("/s/hers/gallery");
    expect(ctaTarget("gallery", "/s/their-name")).toBe("/s/their-name/gallery");
  });

  it("never returns a root-level path for a nested site", () => {
    expect(ctaTarget("gallery", "/s/hers")).not.toBe("/gallery");
    expect(ctaTarget("moments", "/s/hers")).not.toBe("/#moments");
  });

  it("keeps the moments anchor on the home page", () => {
    expect(ctaTarget("moments", "/s/hers")).toBe("/s/hers#moments");
    expect(ctaTarget("moments", "/s/their-name")).toBe("/s/their-name#moments");
  });

  it("handles a trailing slash without doubling it", () => {
    expect(ctaTarget("gallery", "/s/hers/")).toBe("/s/hers/gallery");
    expect(ctaTarget("moments", "/s/hers/")).toBe("/s/hers#moments");
  });

  it("agrees with sitePaths", () => {
    const base = "/s/hers";
    expect(ctaTarget("gallery", base)).toBe(sitePaths(base).gallery);
    expect(ctaTarget("moments", base)).toBe(`${sitePaths(base).home}#moments`);
  });
});

describe("emphasisParts", () => {
  it("returns nothing for an empty quote", () => {
    expect(emphasisParts("")).toEqual({ lead: "", emphasis: "", tail: "" });
    expect(emphasisParts("    ")).toEqual({ lead: "", emphasis: "", tail: "" });
  });

  it("highlights the whole of a single-sentence quote", () => {
    const r = emphasisParts("You are the best part.");
    expect(r.lead).toBe("");
    expect(r.emphasis).toBe("You are the best part.");
    expect(r.tail).toBe("");
  });

  it("highlights only the final sentence when there are several", () => {
    const r = emphasisParts("You are silly. You are dramatic. You are still the best.");
    expect(r.lead).toBe("You are silly. You are dramatic.");
    expect(r.emphasis).toBe("You are still the best.");
    expect(r.tail).toBe("");
  });

  it("handles several sentence-ending marks", () => {
    const r = emphasisParts("Is this real? Yes. Truly the best!");
    expect(r.emphasis).toBe("Truly the best!");
    expect(r.lead).toBe("Is this real? Yes.");
  });

  it("trims surrounding whitespace out of the split", () => {
    const r = emphasisParts("  First part.  Second part.  ");
    expect(r.lead).toBe("First part.");
    expect(r.emphasis).toBe("Second part.");
  });

  /**
   * The reason `emphasis` stopped being a stored field. Editing the quote can
   * never desynchronise the highlight, because there is nothing to desync.
   */
  it("cannot fall out of sync when the author edits the quote", () => {
    const original = "You're silly and dramatic.";
    const edited = "You make every ordinary day feel special.";
    expect(emphasisParts(original).emphasis.length).toBeGreaterThan(0);
    expect(emphasisParts(edited).emphasis.length).toBeGreaterThan(0);
  });

  it("falls back to the whole quote when there is no sentence boundary", () => {
    expect(emphasisParts("no punctuation here").emphasis).toBe("no punctuation here");
  });

  it("does not highlight a fragment too short to be a sentence", () => {
    const r = emphasisParts("A long opening sentence that runs on for a while. A.");
    expect(r.emphasis).toBe("A long opening sentence that runs on for a while. A.");
  });
});

describe("site paths", () => {
  it("derives both destinations from one base", () => {
    expect(sitePaths("/s/hers")).toEqual({ home: "/s/hers", gallery: "/s/hers/gallery" });
    expect(sitePaths("/s/their-name")).toEqual({
      home: "/s/their-name",
      gallery: "/s/their-name/gallery",
    });
  });

  it("does not double a trailing slash", () => {
    expect(sitePaths("/s/hers/").gallery).toBe("/s/hers/gallery");
    expect(momentsAnchor("/s/hers/")).toBe("/s/hers#moments");
  });

  it("leaves the root base alone", () => {
    // "/" normalises to itself, so "" never produces a leading "//".
    expect(sitePaths("/").gallery).toBe("/gallery");
  });

  it("builds an anchor that stays on the home page", () => {
    expect(momentsAnchor("/s/hers")).toBe("/s/hers#moments");
  });

  /**
   * The preview swallows internal links so clicking a button cannot navigate the
   * iframe away. These are the cases that must NOT be swallowed.
   */
  describe("isInternalPageLink", () => {
    it("recognises paths on this origin", () => {
      expect(isInternalPageLink("/s/hers")).toBe(true);
      expect(isInternalPageLink("/s/hers/gallery")).toBe(true);
      expect(isInternalPageLink("/dashboard/hers")).toBe(true);
    });

    it("leaves external links alone", () => {
      expect(isInternalPageLink("https://example.com")).toBe(false);
      expect(isInternalPageLink("//example.com")).toBe(false);
      expect(isInternalPageLink("mailto:someone@example.com")).toBe(false);
      expect(isInternalPageLink("")).toBe(false);
    });

    it("leaves a same-page fragment alone", () => {
      // A fragment does not leave the page, and being able to try it is useful.
      expect(isInternalPageLink("#moments")).toBe(false);
      expect(isInternalPageLink("/s/hers#moments")).toBe(true);
    });
  });
});
describe("visibleBlocks", () => {
  it("shows nothing for a blank site", () => {
    const blocks = visibleBlocks(emptySite("blank"));
    // moments and chapters are always shown; only text blocks should be false
    expect(blocks.hero).toBe(false);
    expect(blocks.quote).toBe(false);
    expect(blocks.quoteTruth).toBe(false);
    expect(blocks.footer).toBe(false);
    expect(blocks.footerCards).toBe(false);
    expect(blocks.galleryHero).toBe(false);
    expect(blocks.outro).toBe(false);
    expect(blocks.moments).toBe(true);
    expect(blocks.chapters).toBe(true);
  });

  it("shows everything for the seeded site", () => {
    const blocks = visibleBlocks(defaultSite());
    // Default site has sample content, so many blocks show.
    expect(blocks.hero).toBe(true);
    expect(blocks.moments).toBe(true);
    expect(blocks.quote).toBe(true);
    expect(blocks.quoteTruth).toBe(true);
    expect(blocks.footer).toBe(true);
    expect(blocks.footerCards).toBe(true);
    expect(blocks.galleryHero).toBe(true);
    expect(blocks.chapters).toBe(true);
    expect(blocks.outro).toBe(true);
  });

  /**
   * The exact failure this module exists to prevent: a quote panel with a
   * button that opens onto an empty letter.
   */
  it("hides the quote toggle when the letter is empty", () => {
    const site = emptySite("x");
    site.home.quote.text = "A quote";
    site.home.quote.truth = "";
    const blocks = visibleBlocks(site);
    expect(blocks.quote).toBe(true);
    expect(blocks.quoteTruth).toBe(false);
  });

  it("hides the quote panel entirely when the quote is empty", () => {
    const site = defaultSite();
    site.home.quote = emptySite("x").home.quote;
    const blocks = visibleBlocks(site);
    expect(blocks.quote).toBe(false);
    expect(blocks.quoteTruth).toBe(false);
  });

  it("will not let closing cards outlive the closing section", () => {
    const site = emptySite("x");
    site.home.footer.cards = [{ id: "c1", tag: "", quote: "" }];
    site.home.footer.heading = "";
    site.home.footer.subline = "";
    expect(site.home.footer.cards.length).toBeGreaterThan(0);
    expect(visibleBlocks(site).footerCards).toBe(false);
  });

  it("shows the closing section on a heading alone", () => {
    const site = emptySite("x");
    site.home.footer.heading = "A heading";
    site.home.footer.subline = "";
    site.home.footer.cards = [];
    expect(visibleBlocks(site).footer).toBe(true);
  });

  it("shows chapters even when every one is empty", () => {
    const site = defaultSite();
    site.gallery.chapters = [];
    // Chapters is always true (media sections always render).
    expect(visibleBlocks(site).chapters).toBe(true);
  });

  it("does not treat whitespace-only fields as content", () => {
    const site = defaultSite();
    site.home.hero.subline = "   ";
    site.home.hero.lines = ["", "", ""];
    site.home.hero.primaryCta = "";
    expect(visibleBlocks(site).hero).toBe(false);
  });
});

describe("siteOutline", () => {
  it("lists the sections of the seeded site as shown", () => {
    const outline = siteOutline(defaultSite());
    expect(outline.length).toBeGreaterThan(0);
    // Default site has sample content — sections are shown.
    expect(outline.filter((e) => e.shown).length).toBeGreaterThan(5);
    expect(outline.every((e) => e.path !== null)).toBe(true);
  });

  it("names each chapter by its derived label", () => {
    const labels = siteOutline(defaultSite())
      .map((e) => e.label)
      .filter((l) => /^\d\d\./.test(l));
    expect(labels).toEqual([
      "01. The first one",
      "02. Just us",
      "03. The ridiculous one",
    ]);
  });

  it("flags a chapter that has no films or photographs", () => {
    const site = emptySite("x");
    site.gallery.chapters.push(
      { id: "ch0", label: "", title: "First", blurb: undefined, films: [], stills: [] },
      { id: "ch1", label: "", title: "Second", blurb: undefined, films: [{ id: "f1", title: "Test", note: "", src: { id: "s1", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null } }], stills: [] },
    );
    site.gallery.chapters[1].films = [];
    site.gallery.chapters[1].stills = [];
    // chapters is always true, but individual chapter entries have shown=false when empty
    const entry = siteOutline(site).find((e) => e.path === "gallery.chapters.1");
    expect(entry?.detail).toBe("No films or photographs yet");
  });

  it("explains why an empty toggle will not appear", () => {
    const site = emptySite("x");
    site.home.quote.text = "A quote";
    site.home.quote.truth = "";
    const entry = siteOutline(site).find((e) => e.path === "home.quote.truth");
    expect(entry?.shown).toBe(false);
    expect(entry?.detail).toBe("Toggle would open onto nothing");
  });

  it("marks the optional blocks as advanced", () => {
    const advanced = siteOutline(defaultSite()).filter((e) => e.advanced);
    expect(advanced.map((e) => e.path)).toContain("home.quote");
    expect(advanced.map((e) => e.path)).toContain("gallery.outro");
  });

  it("keeps paths that actually exist in the config", () => {
    for (const entry of siteOutline(defaultSite())) {
      if (!entry.path) continue;
      const head = entry.path.split(".")[0];
      expect(["home", "gallery"]).toContain(head);
    }
  });
});

describe("derived values survive a save", () => {
  /**
   * Tags and labels are derived from position, so they carry no data. That means
   * two configs differing only by ordering round-trip independently of them.
   */
  it("does not need to store position-derived labels", () => {
    const site = defaultSite();
    const paths = siteOutline(site).filter((e) => e.path?.startsWith("gallery.chapters."));
    expect(paths).toHaveLength(site.gallery.chapters.length);
    expect(site.gallery.chapters.every((c) => !c.label)).toBe(true);
  });

  it("produces the same outline after a JSON round trip", () => {
    const site = defaultSite();
    const before = siteOutline(site).map((e) => `${e.path}:${e.shown}`);
    const after = siteOutline(JSON.parse(JSON.stringify(site))).map((e) => `${e.path}:${e.shown}`);
    expect(after).toEqual(before);
  });

  it("never throws on a site with only a slug", () => {
    expect(() => siteOutline(siteWith())).not.toThrow();
  });
});

describe("readiness", () => {
  /**
   * The readiness meter is the one number the dashboard shows, so it has to be
   * derived from the same walk that reports the problems. If the two were
   * computed separately they would disagree, and the bar would promise progress
   * the issue list did not.
   */
  it("counts the same work items the issue list reports", () => {
    const site = emptySite("blank");
    const state = readiness(site);
    const issues = findIssues(site);

    // Every outstanding item is a real, unmet requirement, so the number of
    // things left must equal the number of items not yet done.
    expect(state.missing).toBe(state.total - state.done);
    expect(state.done + state.missing).toBe(state.total);
    expect(issues.length).toBeGreaterThan(0);
    expect(state.complete).toBe(false);
  });

  it("never reports a percentage outside 0–100", () => {
    for (const site of [emptySite("blank"), defaultSite()]) {
      const state = readiness(site);
      expect(state.percent).toBeGreaterThanOrEqual(0);
      expect(state.percent).toBeLessThanOrEqual(100);
    }
  });

  /**
   * A structurally complete site is still not done while it holds the sample
   * wording — that is the whole reason `findSampleIssues` exists separately.
   */
  it("is not complete while the sample text is still there", () => {
    const state = readiness(defaultSite());
    expect(state.placeholder).toBeGreaterThan(0);
    expect(state.complete).toBe(false);
  });

  it("is complete when every requirement passes and no sample text remains", () => {
    const site = emptySite("real");
    site.identity.name = "Sarah";
    site.home.hero.lines = ["One", "Two", "Three"];
    site.home.hero.subline = "Why";
    site.home.hero.primaryCta = "Look";
    site.home.moments = [
      {
        id: "m1",
        tag: "",
        date: "",
        caption: "A moment",
        secret: "",
        image: {
          id: "i",
          publicId: "p",
          url: "https://x.test/a.jpg",
          alt: "",
          caption: "",
          width: null,
          height: null,
          durationMs: null,
        },
      },
    ];
    site.gallery.chapters = [
      {
        id: "c1",
        label: "",
        title: "Us",
        blurb: undefined,
        films: [],
        stills: [
          {
            id: "s1",
            caption: "",
            src: {
              id: "s",
              publicId: "p",
              url: "https://x.test/s.jpg",
              alt: "",
              caption: "",
              width: null,
              height: null,
              durationMs: null,
            },
          },
        ],
      },
    ];

    const state = readiness(site);
    expect(state.missing).toBe(0);
    expect(state.placeholder).toBe(0);
    expect(state.complete).toBe(true);
    expect(state.percent).toBe(100);
  });

  it("adds work to the total when content is added, so the meter cannot cheat", () => {
    const before = readiness(emptySite("x"));
    const after = readiness(defaultSite());
    expect(after.total).toBeGreaterThan(before.total);
  });
});

describe("uploadProgress", () => {
  /**
   * The ring counts uploads and the words that belong to them, and nothing
   * else. These tests pin the distinction down, because the whole reason this
   * is a separate number from `readiness` is that a heading is not a task.
   */
  it("ignores layout copy entirely", () => {
    const site = emptySite("layout");
    const before = uploadProgress(site);

    // The site name, the headline, the button label: none of them is a
    // photograph and none of them moves the ring.
    site.identity.name = "Sarah";
    site.home.hero.lines = ["One", "Two", "Three"];
    site.home.hero.subline = "Why";
    site.home.hero.primaryCta = "Look";

    const after = uploadProgress(site);
    expect(after.total).toBe(before.total);
    expect(after.done).toBe(before.done);
    expect(after.percent).toBe(before.percent);
  });

  it("counts a photograph and its caption, and a clip and its title", () => {
    const site = emptySite("media");
    const before = uploadProgress(site);

    site.home.moments = [
      {
        id: "m1",
        tag: "",
        date: "",
        caption: "The night it changed.",
        secret: "",
        image: {
          id: "i",
          publicId: "p",
          url: "https://x.test/a.jpg",
          alt: "",
          caption: "",
          width: null,
          height: null,
          durationMs: null,
        },
      },
    ];

    const after = uploadProgress(site);
    /*
      The total grows by two: the photograph and the caption.
      The "at least one moment" item was already in the empty site's total — it
      is a thing to satisfy, not a thing that appears when a moment does — so
      adding the moment satisfies it rather than adding to the count. Which is
      why `done` grows by three and `total` by two.
    */
    expect(after.total).toBe(before.total + 2);
    expect(after.done).toBe(before.done + 3);
  });

  it("counts a photograph with no caption as not finished", () => {
    const site = emptySite("nocaption");
    site.home.moments = [
      {
        id: "m1",
        tag: "",
        date: "",
        caption: "",
        secret: "",
        image: {
          id: "i",
          publicId: "p",
          url: "https://x.test/a.jpg",
          alt: "",
          caption: "",
          width: null,
          height: null,
          durationMs: null,
        },
      },
    ];

    const state = uploadProgress(site);
    expect(state.complete).toBe(false);
    expect(state.missing).toBeGreaterThan(0);
  });

  /**
   * A caption still holding the sample wording has not been written, so the
   * photograph it belongs to is not finished either. The words under a
   * photograph are the one piece of text that cannot be boilerplate.
   */
  it("treats a caption still holding the sample text as unfinished", () => {
    const site = defaultSite();
    const state = uploadProgress(site);
    expect(state.complete).toBe(false);
  });

  it("never reports a percentage outside 0–100", () => {
    for (const site of [emptySite("blank"), defaultSite()]) {
      const state = uploadProgress(site);
      expect(state.percent).toBeGreaterThanOrEqual(0);
      expect(state.percent).toBeLessThanOrEqual(100);
      expect(state.done + state.missing).toBe(state.total);
    }
  });

  it("adds work to the total when content is added, so the ring cannot cheat", () => {
    const before = uploadProgress(emptySite("x"));
    const after = uploadProgress(defaultSite());
    expect(after.total).toBeGreaterThan(before.total);
  });
});

/**
 * The list behind the "Still to do" header.
 *
 * It exists because the header used to be driven by `findIssues`, which counts
 * every empty field and every field still holding the sample wording — 97 things
 * on the seed site, nearly all of them headings and button labels the author
 * never agreed to rewrite. A to-do list that demands work nobody owes is one
 * people learn to stop reading.
 */
describe("uploadItems", () => {
  /**
   * The point of splitting the list out of `uploadProgress` rather than
   * writing a second walk: the number in the header and the rows under it come
   * from the same array, so they cannot drift apart.
   */
  it("counts exactly the items it lists", () => {
    for (const site of [emptySite("x"), defaultSite()]) {
      const items = uploadItems(site);
      const progress = uploadProgress(site);
      expect(progress.total).toBe(items.length);
      expect(progress.done).toBe(items.filter((item) => item.ok).length);
      expect(progress.missing).toBe(items.filter((item) => !item.ok).length);
    }
  });

  /**
   * The whole reason this list is not `findIssues`. The seed site carries 84
   * fields of sample wording — the headline, the eyebrow, the button labels,
   * the modern template's letter — and replacing any of it is a preference, not
   * a task. None of those paths may appear here, however empty they are.
   */
  it("never lists layout copy, however empty it is", () => {
    const layoutPrefixes = [
      "identity",
      "home.hero",
      "home.quote",
      "home.footer",
      "gallery.hero",
      "gallery.outro",
      "modern",
    ];
    const paths = uploadItems(defaultSite()).map((item) => item.path);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      const isLayout = layoutPrefixes.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}.`),
      );
      expect(isLayout).toBe(false);
    }
  });

  it("says what is outstanding, not merely that something is", () => {
    const outstanding = uploadItems(emptySite("x")).filter((item) => !item.ok);
    expect(outstanding.length).toBeGreaterThan(0);
    for (const item of outstanding) {
      expect(item.message.trim().length).toBeGreaterThan(0);
      expect(item.path.trim().length).toBeGreaterThan(0);
    }
  });

  /**
   * A caption still holding the sample wording reads as finished, which is
   * exactly why it is worth naming differently from an empty one: "is empty"
   * would send the author looking for a gap that is not visibly there.
   */
  it("tells a sample caption apart from an empty one", () => {
    const sample = uploadItems(defaultSite()).find(
      (item) => item.path.endsWith(".caption") && !item.ok,
    );
    expect(sample?.message).toContain("placeholder");
  });

  /**
   * The case that motivated getting media off localhost.
   *
   * A `blob:` URL is a non-empty string pointing at nothing — it belonged to
   * the tab that created it and died with it — so a length test calls it
   * finished while every photograph on the site is broken for everyone except
   * the person who uploaded it. Of all the ways a site can be unfinished, this
   * is the only one where it looks finished, so the list has to name it.
   */
  it("reports a stale blob URL as needing re-uploading, not as done", () => {
    const site = emptySite("blob");
    site.home.moments = [
      {
        id: "m1",
        tag: "",
        date: "",
        caption: "Written by hand.",
        secret: "",
        image: {
          id: "i",
          publicId: null,
          url: "blob:https://lovebuilds.test/0f8e4a1b-0000-4000-8000-000000000000",
          alt: "",
          caption: "",
          width: null,
          height: null,
          durationMs: null,
        },
      },
    ];

    const item = uploadItems(site).find((entry) => entry.path === "home.moments.0.image.url");
    expect(item?.ok).toBe(false);
    expect(item?.message).toContain("re-uploading");

    // And the count follows the list, so the header cannot call it done while
    // the row underneath says otherwise.
    expect(uploadProgress(site).missing).toBe(
      uploadItems(site).filter((entry) => !entry.ok).length,
    );
  });
});
