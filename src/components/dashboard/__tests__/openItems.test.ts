import { describe, expect, it } from "vitest";

import { initiallyOpenItems } from "../openItems";
import { sample } from "../../../lib/site/default";

/**
 * The rule under test: nothing starts open unless it is completely empty.
 *
 * A dashboard that arrives with panels expanded is the wall-of-cards problem
 * the collapsed panels were introduced to solve, and the failure is silent —
 * the form still works, it is just unreadable.
 */

describe("initiallyOpenItems", () => {
  it("opens nothing for a site that is not there", () => {
    expect(initiallyOpenItems(null)).toEqual({
      moments: [],
      chapters: [],
      films: [],
      stills: [],
    });
  });

  it("opens nothing for the seeded site", () => {
    const site = sample();

    /*
      The seed is the worst case, and the reason this rule is "completely
      empty" rather than "missing a photo". Its moments have their wording
      written and their photographs still to upload, so a rule that opened on
      a missing photo would arrive with four panels already expanded.
    */
    expect(site.home.moments.length).toBeGreaterThan(0);
    expect(site.home.moments.every((moment) => moment.caption.trim().length > 0)).toBe(true);
    expect(site.home.moments.every((moment) => moment.image.url.trim().length === 0)).toBe(true);

    const open = initiallyOpenItems(site);

    expect(open.moments).toEqual([]);
    expect(open.chapters).toEqual([]);
  });

  it("never opens a film or a still, whatever is in them", () => {
    const site = sample();

    const withMedia = site.gallery.chapters.flatMap((chapter) => [
      ...chapter.films.map((film) => film.id),
      ...chapter.stills.map((still) => still.id),
    ]);
    expect(withMedia.length).toBeGreaterThan(0);

    const open = initiallyOpenItems(site);

    expect(open.films).toEqual([]);
    expect(open.stills).toEqual([]);
  });

  it("opens a moment nobody has touched at all", () => {
    const site = sample();
    const blank = {
      ...site.home.moments[0],
      caption: "",
      secret: "",
      image: { ...site.home.moments[0].image, url: "" },
    };

    const open = initiallyOpenItems({
      ...site,
      home: { ...site.home, moments: [blank, site.home.moments[1]] },
    });

    expect(open.moments).toEqual([blank.id]);
  });

  it("leaves a moment that has a caption shut, even with no photograph", () => {
    const site = sample();
    const written = { ...site.home.moments[0], image: { ...site.home.moments[0].image, url: "" } };

    const open = initiallyOpenItems({
      ...site,
      home: { ...site.home, moments: [written, site.home.moments[1]] },
    });

    expect(open.moments).toEqual([]);
  });

  it("opens the one chapter nobody has started", () => {
    const site = sample();
    const empty = { ...site.gallery.chapters[0], films: [], stills: [] };

    const open = initiallyOpenItems({
      ...site,
      gallery: { ...site.gallery, chapters: [empty, site.gallery.chapters[1]] },
    });

    expect(open.chapters).toEqual([empty.id]);
  });

  it("does not open a chapter that already has a film in it", () => {
    const site = sample();
    const withFilm = site.gallery.chapters[0];

    const open = initiallyOpenItems({
      ...site,
      gallery: {
        ...site.gallery,
        chapters: [{ ...withFilm, stills: [] }, site.gallery.chapters[1]],
      },
    });

    expect(open.chapters).toEqual([]);
  });

  it("ignores a chapter that only holds stills", () => {
    const site = sample();
    const stillsOnly = { ...site.gallery.chapters[0], films: [] };

    const open = initiallyOpenItems({
      ...site,
      gallery: {
        ...site.gallery,
        chapters: [stillsOnly, site.gallery.chapters[1]],
      },
    });

    expect(open.chapters).toEqual([]);
  });
});
