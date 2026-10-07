import { describe, expect, it } from "vitest";

import { defaultSite, emptySite } from "../default";
import {
  appendAtPath,
  getAtPath,
  moveAtPath,
  removeAtPath,
  setAtPath,
} from "../path";
import type { Site } from "../schema";

describe("getAtPath", () => {
  it("reads a nested value", () => {
    expect(getAtPath(defaultSite(), "identity.name")).toBe("Sample Site");
    expect(getAtPath(defaultSite(), "home.hero.lines.0")).toBe("Your headline here");
  });

  it("returns undefined rather than throwing on a missing path", () => {
    expect(getAtPath(defaultSite(), "home.nope")).toBeUndefined();
    expect(getAtPath(defaultSite(), "home.hero.lines.99")).toBeUndefined();
    expect(getAtPath(defaultSite(), "home.hero.lines.0.deeper")).toBeUndefined();
  });

  it("treats an empty path as the whole object", () => {
    const site = defaultSite();
    expect(getAtPath(site, "")).toBe(site);
  });
});

describe("setAtPath", () => {
  it("writes a nested value without mutating the original", () => {
    const before = defaultSite();
    const snapshot = JSON.stringify(before);
    const after = setAtPath(before, "identity.name", "Someone Else");

    expect(getAtPath(after, "identity.name")).toBe("Someone Else");
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("keeps the rest of the config intact", () => {
    const before = defaultSite();
    const after = setAtPath(before, "identity.name", "New");
    expect(after.home.moments).toHaveLength(before.home.moments.length);
    expect(after.gallery.chapters).toHaveLength(before.gallery.chapters.length);
    expect(after.gallery.chapters[0].title).toBe(before.gallery.chapters[0].title);
  });

  it("writes into array elements", () => {
    const site = emptySite("x");
    site.home.moments.push({
      id: "m0",
      tag: "",
      date: "",
      caption: "First",
      secret: "",
      image: { id: "i0", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null },
    });
    site.home.moments.push({
      id: "m1",
      tag: "",
      date: "",
      caption: "Second",
      secret: "",
      image: { id: "i1", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null },
    });
    const after = setAtPath(site, "home.moments.1.caption", "Second one");
    expect(after.home.moments[1]?.caption).toBe("Second one");
    expect(after.home.moments[0]?.caption).not.toBe("Second one");
  });

  it("creates the intermediate list when one is missing", () => {
    const site = emptySite("x");
    const after = setAtPath(site, "home.moments.0.caption", "First");
    expect(after.home.moments).toHaveLength(1);
    expect(after.home.moments[0]?.caption).toBe("First");
  });

  it("creates an intermediate object for a non-numeric segment", () => {
    const after = setAtPath(emptySite("x"), "home.quote.author", "Me");
    expect(after.home.quote.author).toBe("Me");
  });

  it("only replaces identity along the changed branch", () => {
    const before = defaultSite();
    const after = setAtPath(before, "home.quote.author", "X");

    // Siblings inside the touched object are new...
    expect(after.home.quote).not.toBe(before.home.quote);
    // ...but untouched branches keep their identity, which is what stops a
    // keystroke re-rendering every moment card and every chapter.
    expect(after.gallery).toBe(before.gallery);
    expect(after.home.moments).toBe(before.home.moments);
  });

  it("still satisfies the schema after a write", () => {
    const after = setAtPath(defaultSite(), "home.hero.primaryCta", "See the videos");
    expect(() => emptySite("x")).not.toThrow();
    expect(getAtPath(after, "home.hero.primaryCta")).toBe("See the videos");
  });

  it("can clear a string by writing an empty one", () => {
    const after = setAtPath(defaultSite(), "home.quote.truth", "");
    expect(after.home.quote.truth).toBe("");
  });
});

describe("removeAtPath", () => {
  it("splices an array rather than leaving a hole", () => {
    const site = emptySite("x");
    site.home.moments.push(
      { id: "m0", tag: "", date: "", caption: "First", secret: "", image: { id: "i0", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null } },
      { id: "m1", tag: "", date: "", caption: "Second", secret: "", image: { id: "i1", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null } },
      { id: "m2", tag: "", date: "", caption: "Third", secret: "", image: { id: "i2", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null } },
    );
    const before = site;
    const after = removeAtPath(before, "home.moments.1");

    expect(after.home.moments).toHaveLength(2);
    expect(after.home.moments.map((m) => m.caption)).not.toContain(before.home.moments[1]?.caption);
    expect(after.home.moments.every((m) => m.image)).toBe(true);
  });

  it("keeps the ids unique and in order after a splice", () => {
    const site = emptySite("x");
    site.gallery.chapters.push(
      { id: "first-meeting", label: "", title: "", blurb: undefined, films: [], stills: [] },
      { id: "just-us", label: "", title: "", blurb: undefined, films: [], stills: [] },
      { id: "stunning", label: "", title: "", blurb: undefined, films: [], stills: [] },
      { id: "get-weirder", label: "", title: "", blurb: undefined, films: [], stills: [] },
    );
    const before = site;
    const after = removeAtPath(before, "gallery.chapters.0");
    expect(after.gallery.chapters.map((c) => c.id)).toEqual(["just-us", "stunning", "get-weirder"]);
  });

  it("removes an object key", () => {
    const after = removeAtPath(defaultSite(), "identity.name");
    expect("name" in after.identity).toBe(false);
  });

  it("ignores an out-of-range index instead of corrupting the list", () => {
    const before = defaultSite();
    expect(removeAtPath(before, "home.moments.99")).toEqual(before);
    expect(removeAtPath(before, "home.moments.-1")).toEqual(before);
  });
});

describe("appendAtPath", () => {
  it("adds to an existing list", () => {
    const site = emptySite("x");
    site.home.moments.push({
      id: "m0",
      tag: "",
      date: "",
      caption: "First",
      secret: "",
      image: { id: "i0", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null },
    });
    const before = site;
    const after = appendAtPath(site, "home.moments", site.home.moments[0]!);
    expect(after.home.moments).toHaveLength(before.home.moments.length + 1);
    expect(after.home.moments[1]?.caption).toBe(before.home.moments[0]?.caption);
  });

  it("creates the list when it is missing", () => {
    const after = appendAtPath(emptySite("x"), "gallery.chapters", { id: "c1" });
    expect(after.gallery.chapters).toHaveLength(1);
  });

  it("does not mutate the original", () => {
    const before = defaultSite();
    const snapshot = before.home.moments.length;
    appendAtPath(before, "home.moments", before.home.moments[0]!);
    expect(before.home.moments).toHaveLength(snapshot);
  });
});

describe("moveAtPath", () => {
  it("moves an item forward", () => {
    const site = emptySite("x");
    site.gallery.chapters.push(
      { id: "first-meeting", label: "", title: "", blurb: undefined, films: [], stills: [] },
      { id: "just-us", label: "", title: "", blurb: undefined, films: [], stills: [] },
      { id: "stunning", label: "", title: "", blurb: undefined, films: [], stills: [] },
      { id: "get-weirder", label: "", title: "", blurb: undefined, films: [], stills: [] },
    );
    const before = site;
    const after = moveAtPath(before, "gallery.chapters", 0, 2);
    expect(after.gallery.chapters.map((c) => c.id)).toEqual([
      "just-us",
      "stunning",
      "first-meeting",
      "get-weirder",
    ]);
  });

  it("moves an item backward", () => {
    const site = emptySite("x");
    site.home.moments.push(
      { id: "m0", tag: "", date: "", caption: "First", secret: "", image: { id: "i0", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null } },
      { id: "m1", tag: "", date: "", caption: "Second", secret: "", image: { id: "i1", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null } },
      { id: "m2", tag: "", date: "", caption: "Third", secret: "", image: { id: "i2", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null } },
      { id: "m3", tag: "", date: "", caption: "Fourth", secret: "", image: { id: "i3", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null } },
    );
    const before = site;
    const after = moveAtPath(before, "home.moments", 3, 0);
    expect(after.home.moments[0]?.id).toBe("m3");
  });

  it("clamps a drag past the end rather than dropping the item", () => {
    const site = emptySite("x");
    site.home.moments.push(
      { id: "m0", tag: "", date: "", caption: "First", secret: "", image: { id: "i0", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null } },
      { id: "m1", tag: "", date: "", caption: "Second", secret: "", image: { id: "i1", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null } },
      { id: "m2", tag: "", date: "", caption: "Third", secret: "", image: { id: "i2", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null } },
      { id: "m3", tag: "", date: "", caption: "Fourth", secret: "", image: { id: "i3", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null } },
    );
    const before = site;
    const after = moveAtPath(before, "home.moments", 0, 99);
    expect(after.home.moments).toHaveLength(4);
    expect(after.home.moments[3]?.id).toBe("m0");
  });

  it("does not mutate the original", () => {
    const before = defaultSite();
    const snapshot = before.gallery.chapters.map((c) => c.id);
    moveAtPath(before, "gallery.chapters", 0, 3);
    expect(before.gallery.chapters.map((c) => c.id)).toEqual(snapshot);
  });
});

/**
 * The paths the dashboard binds inputs to must be real paths into the config.
 * A typo here is the kind of thing that types happily into the void.
 */
describe("paths used by the dashboard", () => {
  const cases: [string, unknown][] = [
    ["identity.name", "string"],
    ["home.hero.lines.0", "string"],
    ["home.hero.subline", "string"],
    ["home.hero.primaryCta", "string"],
    ["home.hero.secondaryCta", "string"],
    ["home.moments", "array"],
    ["home.quote.text", "string"],
    ["home.quote.truth", "string"],
    ["home.quote.author", "string"],
    ["home.quote.authorSub", "string"],
    ["home.quote.verdictLabel", "string"],
    ["home.quote.verdictValue", "string"],
    ["home.footer.heading", "string"],
    ["home.footer.subline", "string"],
    ["home.footer.ctaLabel", "string"],
    ["home.footer.cards", "array"],
    ["gallery.hero.eyebrow", "string"],
    ["gallery.hero.lineOne", "string"],
    ["gallery.hero.lineTwo", "string"],
    ["gallery.hero.blurb", "string"],
    ["gallery.chapters", "array"],
    ["gallery.outro.lineOne", "string"],
    ["gallery.outro.lineTwo", "string"],
    ["gallery.outro.aside", "string"],
    ["gallery.outro.backLabel", "string"],
    ["theme", "string"],
    ["ornaments.hero3d", "boolean"],
    ["ornaments.particles", "boolean"],
  ];

  it.each(cases)("%s exists and is a %s", (path, kind) => {
    const site = defaultSite();
    const value = getAtPath(site, path);
    expect(value, `${path} is missing from the seeded config`).toBeDefined();
    expect(Array.isArray(value)).toBe(kind === "array");
    if (kind === "boolean") expect(typeof value).toBe("boolean");
    if (kind === "string") expect(typeof value).toBe("string");
  });

  it("reaches into nested list items", () => {
    const site = emptySite("x");
    site.home.moments.push({
      id: "m0",
      tag: "",
      date: "",
      caption: "Do you remember when we first met?",
      secret: "",
      image: { id: "i0", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null },
    });
    site.gallery.chapters.push({
      id: "ch0",
      label: "",
      title: "First meeting",
      blurb: undefined,
      films: [{ id: "f0", title: "I was so nervous lol", note: "", src: { id: "s0", publicId: null, url: "", alt: "", caption: "", width: null, height: null, durationMs: null } }],
      stills: [{ id: "st1", caption: "", src: { id: "st1", publicId: null, url: "/media/photo.jpg", alt: "", caption: "", width: null, height: null, durationMs: null } }],
    });
    expect(getAtPath(site, "home.moments.0.caption")).toBe("Do you remember when we first met?");
    expect(getAtPath(site, "gallery.chapters.0.films.0.title")).toBe("I was so nervous lol");
    expect(getAtPath(site, "gallery.chapters.0.stills.0.src.url")).toBe("/media/photo.jpg");
  });

  it("keeps the whole config valid after editing every bound path", () => {
    let site: Site = emptySite("x");
    for (const [path] of cases) {
      const current = getAtPath(site, path);
      const next = typeof current === "string" ? "edited" : Array.isArray(current) ? current : current;
      site = setAtPath(site, path, next);
    }
    expect(getAtPath(site, "identity.name")).toBe("edited");
    expect(site.gallery.chapters).toHaveLength(0);
  });
});