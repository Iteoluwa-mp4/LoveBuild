import { describe, expect, it } from "vitest";
import {
  chapterLabel,
  ctaTarget,
  emphasisParts,
  hasContent,
  momentTag,
  modernMemories,
  siteOutline,
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
