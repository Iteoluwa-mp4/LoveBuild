import { describe, expect, it } from "vitest";
import { createDraft, defaultSite, emptyMedia, emptySite, findSampleText } from "../default";
import { visibleBlocks } from "../derive";
import { findSubmissionIssues, siteSchema } from "../schema";
import { defaultThemeId, resolveTheme, themeIds, themes } from "../themes";

describe("schema", () => {
  it("accepts the seeded site", () => {
    expect(() => siteSchema.parse(defaultSite())).not.toThrow();
  });

  /**
   * A draft is allowed to be almost empty, so every nested object has to
   * materialise from nothing. This is the regression test for that: a plain
   * `.default({})` returns `{}` unparsed in Zod 4 and inner defaults never fire.
   */
  it("builds a complete blank site from only a slug and a theme", () => {
    const site = emptySite("new-site");
    expect(site.slug).toBe("new-site");
    expect(site.theme).toBe(defaultThemeId);
    expect(site.version).toBe(1);
  });

  it("fills every nested default rather than leaving holes", () => {
    const site = emptySite("new-site");
    expect(site.home.moments).toEqual([]);
    expect(site.home.hero.lines).toEqual(["", "", ""]);
    expect(site.home.hero.primaryCta).toBe("");
    expect(site.home.quote.text).toBe("");
    expect(site.home.footer.cards).toEqual([]);
    expect(site.gallery.chapters).toEqual([]);
    expect(site.gallery.outro.lineOne).toBe("");
    expect(site.identity.name).toBe("");
    expect(site.ornaments).toEqual({ hero3d: true, particles: true });
    // A blank site carries no template-specific copy either, so switching to
    // modern shows empty slots rather than placeholder wording.
    expect(site.template).toBe("classic");
    expect(site.modern.hero.lines).toEqual(["", "", ""]);
    expect(site.modern.hero.subline).toBe("");
    expect(site.modern.closing.heading).toBe("");
  });

  /**
   * Computed values must not be stored, or they can disagree with each other.
   * A stored `Moment 01` on the third card is exactly the bug this prevents.
   */
  it("stores no values that derive from position", () => {
    const site = defaultSite();
    expect(site.home.moments.every((m) => m.tag === "")).toBe(true);
    expect(site.gallery.chapters.every((c) => c.label === "")).toBe(true);
    expect(typeof site.home.hero.primaryCta).toBe("string");
    expect("emphasis" in site.home.quote).toBe(false);
    expect("navHome" in site.identity).toBe(false);
  });

  /**
   * The config lands in a Postgres `jsonb` column. `undefined` values are
   * silently dropped by JSON.stringify, so a field can vanish on a round trip
   * and the schema would not notice until the site is already live.
   */
  it("survives a JSON round trip unchanged", () => {
    const site = defaultSite();
    const revived = siteSchema.parse(JSON.parse(JSON.stringify(site)));
    expect(revived).toEqual(site);
  });

  it("rejects a slug that is not url-safe", () => {
    expect(() => siteSchema.parse({ ...emptySite("x"), slug: "Their Name" })).toThrow();
    expect(() => siteSchema.parse({ ...emptySite("x"), slug: "a/b" })).toThrow();
  });

  /**
   * Status lives in the database column, not the config. A config carrying its
   * own copy could disagree with `sites.status`, and row level security reads
   * the column — so the two together would be a security bug waiting to happen.
   */
  it("has no status field of its own", () => {
    expect("status" in defaultSite()).toBe(false);
  });

  it("rejects a config version it does not understand", () => {
    expect(() => siteSchema.parse({ ...emptySite("x"), version: 2 })).toThrow();
  });

  it("caps list lengths so a pasted file cannot produce an unusable page", () => {
    const site = defaultSite();
    const tooMany = {
      ...site,
      gallery: {
        ...site.gallery,
        chapters: Array.from({ length: 41 }, (_, i) => ({
          ...site.gallery.chapters[0],
          id: `c${i}`,
        })),
      },
    };
    expect(() => siteSchema.parse(tooMany)).toThrow();
  });

  it("keeps a chapter's films and stills nested rather than flattened", () => {
    const site = emptySite("x");
    site.gallery.chapters.push({
      id: "ch0",
      label: "",
      title: "Test chapter",
      blurb: undefined,
      films: [{ id: "f0", title: "Test", note: "", src: { id: "s0", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null } }],
      stills: [{ id: "st0", caption: "", src: { id: "sti0", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null } }],
    });
    const chapter = site.gallery.chapters[0];
    expect(chapter.films.length).toBeGreaterThan(0);
    expect(Array.isArray(chapter.stills)).toBe(true);
  });

  it("treats an absent chapter blurb as absent, not empty", () => {
    const site = emptySite("x");
    site.gallery.chapters.push({
      id: "ch0",
      label: "",
      title: "Test",
      blurb: undefined,
      films: [],
      stills: [],
    });
    const without = siteSchema.parse({
      ...site,
      gallery: {
        ...site.gallery,
        chapters: [{ ...site.gallery.chapters[0], blurb: undefined }],
      },
    });
    expect(without.gallery.chapters[0].blurb).toBeUndefined();
  });
});

describe("submission checks", () => {
  it("flags every gap in a blank site", () => {
    const issues = findSubmissionIssues(emptySite("blank"));
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.map((i) => i.path)).toContain("identity.name");
    expect(issues.map((i) => i.path)).toContain("home.moments");
    expect(issues.map((i) => i.path)).toContain("gallery.chapters");
  });

  it("still reports missing files on the sample site", () => {
    // The sample fills every text field but leaves media empty, which is the
    // point: placeholder copy demonstrates the layout, a real photograph does
    // not belong in a template.
    const issues = findSubmissionIssues(defaultSite());
    expect(issues.map((i) => i.path)).toContain("home.moments.0.image.url");
  });

  it("catches a media entry whose upload never finished", () => {
    const site = emptySite("x");
    site.home.moments.push({
      id: "m1",
      tag: "",
      date: "",
      caption: "A moment",
      secret: "A secret",
      image: { id: "img1", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null },
    });
    const paths = findSubmissionIssues(site).map((i) => i.path);
    expect(paths).toContain("home.moments.0.image.url");
  });

  it("catches a chapter with neither films nor photographs", () => {
    const site = emptySite("x");
    site.gallery.chapters.push({
      id: "ch1",
      label: "",
      title: "My chapter",
      blurb: undefined,
      films: [],
      stills: [],
    });
    const paths = findSubmissionIssues(site).map((i) => i.path);
    expect(paths).toContain("gallery.chapters.0");
  });
});

/**
 * The sample copy is a starting point, not someone else's site.
 *
 * It used to hold one person's birthday site — their partner's name, their
 * headline, their photographs. What replaced it is instructional: each line says
 * what belongs in that slot, so the layout can be seen populated and whoever is
 * filling it in is told what to write.
 *
 * The assertions below are the guard, and the media one is the important one. A
 * stray photograph or video from a real site creeping back in is the failure that
 * actually matters here — it would be republished as this project's demo, to
 * whoever opens the link.
 */
describe("the sample content", () => {
  const site = defaultSite();

  it("says what belongs in each slot rather than shipping nothing", () => {
    // An empty template is useless: you cannot tell whether a section is working
    // until there is something in it. Every text region is filled.
    expect(site.identity.name).not.toBe("");
    expect(site.home.hero.lines[0]).not.toBe("");
    expect(site.home.hero.subline).not.toBe("");
    expect(site.home.hero.primaryCta).not.toBe("");
    expect(site.home.quote.text).not.toBe("");
    expect(site.home.footer.heading).not.toBe("");
    expect(site.home.moments.length).toBeGreaterThan(0);
    expect(site.gallery.chapters.length).toBeGreaterThan(0);
  });

  /**
   * The one that matters. No real photograph or video ships with the template,
   * regardless of what else lives in the config.
   */
  it("references no media file at all", () => {
    const urls: string[] = [];
    const publicIds: (string | null)[] = [];
    site.home.moments.forEach((m) => {
      urls.push(m.image.url);
      publicIds.push(m.image.publicId);
    });
    site.gallery.chapters.forEach((c) => {
      c.films.forEach((film) => {
        urls.push(film.src.url);
        publicIds.push(film.src.publicId);
      });
      c.stills.forEach((s) => {
        urls.push(s.src.url);
        publicIds.push(s.src.publicId);
      });
    });
    expect(urls.filter((u) => u.trim() !== "")).toEqual([]);
    expect(publicIds.filter((p) => p !== null)).toEqual([]);
  });

  it("shows every region, so the whole layout is visible", () => {
    const blocks = visibleBlocks(site);
    expect(blocks.hero).toBe(true);
    expect(blocks.moments).toBe(true);
    expect(blocks.quote).toBe(true);
    expect(blocks.footer).toBe(true);
    expect(blocks.chapters).toBe(true);
    expect(blocks.outro).toBe(true);
  });

  /**
   * A new site starts FROM the sample, so the first edit is a small one. The
   * guarantee is not that it is blank — it is that nothing personal is inherited,
   * and that every placeholder line is flagged until it is replaced.
   */
  it("seeds a new site from the sample, under its own slug", () => {
    const draft = createDraft("for-sarah");
    expect(draft.slug).toBe("for-sarah");
    expect(draft.identity.name).not.toBe("");
    expect(draft.home.hero.lines[0]).not.toBe("");
    expect(draft.home.moments.length).toBeGreaterThan(0);
    // Still nothing of anyone's, so still flagged.
    expect(findSampleText(draft).length).toBeGreaterThan(0);
  });

  it("gives each new site its own ids, so two drafts do not collide", () => {
    const a = createDraft("one");
    const b = createDraft("two");
    expect(a.home.moments[0].id).not.toBe(b.home.moments[0].id);
    expect(a.gallery.chapters[0].id).not.toBe(b.gallery.chapters[0].id);
  });
});

/**
 * Templates.
 *
 * The field has to be forgiving in both directions, because a config can arrive
 * from before it existed and from a build that knew a template this one does
 * not. Neither is a reason to refuse to render somebody's site.
 */
describe("templates", () => {
  it("defaults to classic when the key is absent", () => {
    const legacy: Record<string, unknown> = { ...defaultSite() };
    delete legacy.template;
    expect(siteSchema.parse(legacy).template).toBe("classic");
  });

  it("keeps a template it recognises", () => {
    expect(siteSchema.parse({ ...defaultSite(), template: "modern" }).template).toBe("modern");
  });

  it("falls back to classic for one it does not", () => {
    expect(siteSchema.parse({ ...defaultSite(), template: "scrapbook" }).template).toBe("classic");
  });

  /**
   * Both templates read `home.moments`, so switching cannot strand an upload.
   * This is the guarantee behind the dashboard's template picker, so it is
   * asserted on the config rather than left to the UI.
   */
  it("stores the photographs once, for whichever template is selected", () => {
    // Built rather than pushed onto the sample, so this test does not depend on
    // the sample's own wording. Only the image is asserted on; the text fields
    // have their own limits and are not what this is about.
    const site = emptySite("t");
    site.template = "modern";
    site.home.moments.push({
      id: "m1",
      tag: "orbit",
      date: "",
      caption: "One",
      secret: "Two",
      image: { ...emptyMedia(), url: "https://example.test/a.jpg" },
    });

    const switched = siteSchema.parse(site);
    expect(switched.template).toBe("modern");
    expect(switched.home.moments[0].image.url).toBe("https://example.test/a.jpg");
  });

  /**
   * `modern` holds copy only. A media field here would be a second place to
   * upload the same photograph, and the two lists could disagree.
   */
  it("keeps media out of the modern block", () => {
    const modern = defaultSite().modern as Record<string, unknown>;
    const serialised = JSON.stringify(modern);
    expect(serialised).not.toContain("publicId");
    expect(serialised).not.toContain('"url"');
  });
});

describe("empty media slots", () => {
  it("has no url, so the template renders a placeholder rather than a broken image", () => {
    const media = emptyMedia();
    expect(media.url).toBe("");
    expect(media.publicId).toBeNull();
  });

  it("is valid inside a moment", () => {
    const site = emptySite("x");
    site.home.moments.push({
      id: "m1",
      tag: "",
      date: "",
      caption: "",
      secret: "",
      image: emptyMedia(),
    });
    expect(() => siteSchema.parse(site)).not.toThrow();
  });
});

describe("themes", () => {
  /**
   * Every preset is produced by `buildTokens`, so this should hold by
   * construction. It is asserted anyway because a hand-written override or a
   * typo in a key name would otherwise fail silently as a missing colour.
   */
  it("gives every preset an identical token key set", () => {
    const reference = Object.keys(themes[defaultThemeId].tokens).sort();
    for (const id of themeIds) {
      expect(Object.keys(themes[id].tokens).sort()).toEqual(reference);
    }
  });

  it("has no empty or malformed token values", () => {
    for (const id of themeIds) {
      for (const [key, value] of Object.entries(themes[id].tokens)) {
        expect(key.startsWith("--theme-"), `${id} has a non-token key: ${key}`).toBe(true);
        expect(value.length, `${id}.${key} is empty`).toBeGreaterThan(0);
        expect(value, `${id}.${key} is undefined`).not.toContain("undefined");
      }
    }
  });

  it("declares a hex palette with no shorthand or missing digits", () => {
    for (const id of themeIds) {
      for (const [name, value] of Object.entries(themes[id].palette)) {
        expect(value, `${id}.palette.${name}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it("falls back to the default rather than throwing on an unknown id", () => {
    expect(resolveTheme("does-not-exist")).toBe(themes[defaultThemeId]);
    expect(resolveTheme(undefined)).toBe(themes[defaultThemeId]);
    expect(resolveTheme(null)).toBe(themes[defaultThemeId]);
    expect(resolveTheme("rose")).toBe(themes.rose);
  });

  it("seeds the default site with a theme that exists", () => {
    expect(resolveTheme(defaultSite().theme)).toBeDefined();
  });
});