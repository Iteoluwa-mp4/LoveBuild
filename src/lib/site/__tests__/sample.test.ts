import { describe, expect, it } from "vitest";
import { defaultSite, emptySite, findSampleText, isSampleText, sampleTextLabel } from "../default";
import { findIssues, findSampleIssues, hasContent } from "../derive";
import type { Site } from "../schema";

/**
 * The placeholder-text guard.
 *
 * Sample copy has to exist — an empty template cannot be judged, and an empty
 * form tells whoever is filling it in nothing about what goes where. But a
 * filled-in field is the one people forget, because nothing about it looks
 * unfinished. These tests are what stops that wording reaching a visitor.
 */

describe("isSampleText", () => {
  it("recognises a field still holding its wording", () => {
    expect(isSampleText("identity.name", "Her name")).toBe(true);
    expect(isSampleText("home.hero.primaryCta", "Open the gallery")).toBe(true);
  });

  /** Trimmed, so trailing whitespace from a paste does not defeat the check. */
  it("ignores surrounding whitespace", () => {
    expect(isSampleText("identity.name", "  Her name  ")).toBe(true);
  });

  it("does not fire once the wording is replaced", () => {
    expect(isSampleText("identity.name", "Sarah")).toBe(false);
  });

  it("ignores a field the sample leaves empty", () => {
    // The sample's moment tags are blank so numbers get derived. A blank field
    // is not "still sample text" — there was never any.
    expect(isSampleText("home.moments.0.tag", "")).toBe(false);
  });

  it("ignores non-strings", () => {
    expect(isSampleText("identity.name", 42)).toBe(false);
    expect(isSampleText("identity.name", null)).toBe(false);
    expect(isSampleText("identity.name", undefined)).toBe(false);
  });

  it("is not fooled by a different field's wording", () => {
    expect(isSampleText("identity.name", "Open the gallery")).toBe(false);
  });
});

describe("findSampleText", () => {
  /**
   * The bulk check. A new sample field must show up here automatically, which is
   * why the comparison walks the sample config rather than a hand-kept list that
   * would drift out of date the moment someone added a section.
   */
  it("reports every placeholder field on an untouched sample", () => {
    const paths = findSampleText(defaultSite());
    expect(paths).toContain("identity.name");
    expect(paths).toContain("home.hero.lines.0");
    expect(paths).toContain("home.quote.text");
    expect(paths).toContain("home.footer.heading");
    expect(paths).toContain("gallery.outro.lineOne");
  });

  it("clears as fields are filled in", () => {
    const site = defaultSite();
    const before = findSampleText(site).length;

    site.identity.name = "Sarah";
    site.home.hero.lines[0] = "Annoying";
    site.home.quote.text = "Something she said";

    const after = findSampleText(site);
    expect(before).toBeGreaterThan(3);
    expect(after).not.toContain("identity.name");
    expect(after).not.toContain("home.hero.lines.0");
    expect(after).not.toContain("home.quote.text");
  });

  it("reports nothing for a blank site", () => {
    // Nothing there to be a copy of. A new site is not flagged.
    expect(findSampleText(emptySite("new"))).toEqual([]);
  });

  it("leaves other fields alone when one is replaced", () => {
    const site = defaultSite();
    site.identity.name = "Sarah";
    const remaining = findSampleText(site);
    expect(remaining).not.toContain("identity.name");
    expect(remaining).toContain("home.footer.heading");
  });

  it("survives an array element being removed", () => {
    // Paths are positional. Removing moment 1 used to be the way to get an index
    // out of range, and a throw here would take the whole dashboard with it.
    const site = defaultSite();
    site.home.moments.splice(0, 1);
    expect(() => findSampleText(site)).not.toThrow();
    expect(findSampleText(site)).not.toContain("home.moments.0.caption");
  });

  it("survives the sample having more items than the site", () => {
    // The reverse case: an edited site can have fewer chapters than the sample,
    // so the walk looks up paths that do not exist.
    const site = defaultSite();
    site.gallery.chapters = [];
    expect(() => findSampleText(site)).not.toThrow();
    expect(findSampleText(site)).not.toContain("gallery.chapters.0.title");
  });
});

describe("sampleTextLabel", () => {
  /**
   * Regression. A headline line lives at `home.hero.lines.0`, so the naive leaf
   * name was the string "0" — the dashboard said "0 still has the placeholder
   * text", which is true and completely useless.
   */
  it("names an array element rather than printing its index", () => {
    expect(sampleTextLabel("home.hero.lines.0")).toBe("Headline, line 1");
  });

  it("describes an item inside a list, with its position", () => {
    expect(sampleTextLabel("home.moments.0.caption")).toBe("Moment 1 Caption");
    expect(sampleTextLabel("home.moments.1.secret")).toBe("Moment 2 Secret");
    expect(sampleTextLabel("home.footer.cards.0.quote")).toBe("Card 1 Quote");
    expect(sampleTextLabel("gallery.chapters.1.title")).toBe("Chapter 2 Title");
    expect(sampleTextLabel("gallery.chapters.0.films.0.note")).toBe("Video 1 Note");
    expect(sampleTextLabel("gallery.chapters.0.stills.1.caption")).toBe("Photo 2 Caption");
  });

  it("uses one-based positions, matching the form", () => {
    // The list is zero-indexed in config and one-indexed everywhere a person
    // sees it. Reporting "Moment 0" would send them to the wrong row.
    expect(sampleTextLabel("home.moments.0.caption")).not.toContain("Moment 0");
  });

  it("does not crash on a collection it has no name for", () => {
    // An unknown collection still reads as a position, so a new list added later
    // produces a usable warning instead of "0 still has the placeholder text".
    expect(sampleTextLabel("home.somethingNew.0.thing")).toBe("Something New 1 Thing");
  });

  it("splits camelCase on a plain field", () => {
    expect(sampleTextLabel("home.quote.verdictValue")).toBe("Verdict Value");
  });
});

describe("findSampleIssues", () => {
  it("gives a readable message and a path to jump to", () => {
    const issues = findSampleIssues(defaultSite());
    const nameIssue = issues.find((i) => i.path === "identity.name");
    expect(nameIssue?.message).toBe("Name still has the placeholder text");
  });

  it("is empty for a blank site", () => {
    expect(findSampleIssues(emptySite("new"))).toEqual([]);
  });
});

describe("findIssues", () => {
  /**
   * The two lists answer different questions and must both be reported. A
   * complete-looking site full of placeholder copy is exactly the case that a
   * completeness check alone waves through.
   */
  it("reports placeholder text even on an otherwise complete site", () => {
    const site: Site = defaultSite();
    // Make it structurally complete: every file present.
    site.home.moments.forEach((m) => {
      m.image.url = "https://example.test/a.jpg";
      m.image.publicId = "a";
    });
    site.gallery.chapters.forEach((c) => {
      c.films.forEach((f) => {
        f.src.url = "https://example.test/v.mp4";
        f.src.publicId = "v";
      });
      c.stills.forEach((s) => {
        s.src.url = "https://example.test/s.jpg";
        s.src.publicId = "s";
      });
    });

    // No missing-field complaints left.
    expect(findIssues(site).filter((i) => !i.message.includes("placeholder"))).toEqual([]);
    expect(findIssues(site).length).toBeGreaterThan(0);
  });

  it("puts placeholder text first, since it is the easier miss", () => {
    const issues = findIssues(defaultSite());
    const firstSample = issues.findIndex((i) => i.message.includes("placeholder"));
    const firstMissing = issues.findIndex((i) => i.message.includes("missing") || i.message.includes("empty"));
    expect(firstSample).toBeGreaterThanOrEqual(0);
    if (firstMissing >= 0) expect(firstSample).toBeLessThan(firstMissing);
  });

  it("is empty only when nothing is left to do", () => {
    const site = emptySite("real");
    site.identity.name = "Sarah";
    site.home.hero.lines = ["One", "Two", "Three"];
    site.home.hero.subline = "Why";
    site.home.hero.primaryCta = "Look";
    site.gallery.chapters = [
      {
        id: "c1",
        label: "",
        title: "Us",
        blurb: undefined,
        films: [
          {
            id: "f1",
            title: "A clip",
            note: "",
            src: { id: "s", publicId: "p", url: "https://x.test/v.mp4", alt: "", caption: "", width: null, height: null, durationMs: null },
          },
        ],
        stills: [],
      },
    ];
    // Media moments are required too.
    site.home.moments = [
      {
        id: "m1",
        tag: "",
        date: "",
        caption: "A moment",
        secret: "",
        image: { id: "i", publicId: "p", url: "https://x.test/a.jpg", alt: "", caption: "", width: null, height: null, durationMs: null },
      },
    ];

    expect(findIssues(site)).toEqual([]);
  });
});

describe("the sample and a blank site stay distinct", () => {
  /**
   * The distinction that keeps the two apart: `defaultSite` is for looking at the
   * design, `createDraft` is for a real person's site and starts empty.
   */
  it("a real site inherits nothing from the sample", () => {
    const draft = emptySite("for-sarah");
    expect(findSampleText(draft)).toEqual([]);
    expect(hasContent(draft.identity.name)).toBe(false);
  });

  it("replacing every sample field leaves the sample site valid", () => {
    const site = defaultSite();
    for (const path of findSampleText(site)) {
      let cursor = site as unknown as Record<string, unknown>;
      const keys = path.split(".");
      for (const key of keys.slice(0, -1)) cursor = cursor[key] as Record<string, unknown>;
      cursor[keys.at(-1)!] = "Something real";
    }
    expect(findSampleText(site)).toEqual([]);
  });
});
