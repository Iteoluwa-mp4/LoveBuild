import { describe, expect, it } from "vitest";

import { SECTION_ID, sectionIdFor } from "../jumpTarget";

/**
 * The rule under test: a config path resolves to the section that owns it, or
 * to nothing.
 *
 * This is the mapping the old heading-matching bug lived in. It looked
 * reasonable and resolved every path in What's Left? to `null` in practice,
 * because the heading it searched for ("Moments") was not the heading the form
 * rendered ("Photographs (4)"). Nothing threw — the buttons just went nowhere.
 * These assertions pin the paths the dashboard actually hands it, so the next
 * rename of a section title cannot quietly take the buttons with it: the ids
 * here are the same `SECTION_ID` values the sections are built with.
 */
describe("sectionIdFor", () => {
  it("maps every path What's Left? produces to the section holding it", () => {
    // The list counts uploads and their captions — see `uploadItems`.
    expect(sectionIdFor("home.moments")).toBe(SECTION_ID.moments);
    expect(sectionIdFor("home.moments.1.image.url")).toBe(SECTION_ID.moments);
    expect(sectionIdFor("home.moments.1.caption")).toBe(SECTION_ID.moments);
    expect(sectionIdFor("gallery.chapters")).toBe(SECTION_ID.chapters);
    expect(sectionIdFor("gallery.chapters.0")).toBe(SECTION_ID.chapters);
    expect(sectionIdFor("gallery.chapters.0.films.1.title")).toBe(SECTION_ID.chapters);
    expect(sectionIdFor("gallery.chapters.2.stills.0.src.url")).toBe(SECTION_ID.chapters);
  });

  it("maps the outline's rows to their sections", () => {
    expect(sectionIdFor("home.hero")).toBe(SECTION_ID.hero);
    expect(sectionIdFor("home.moments")).toBe(SECTION_ID.moments);
    expect(sectionIdFor("home.quote")).toBe(SECTION_ID.quote);
    expect(sectionIdFor("home.quote.truth")).toBe(SECTION_ID.quote);
    expect(sectionIdFor("home.footer")).toBe(SECTION_ID.footer);
    expect(sectionIdFor("home.footer.cards")).toBe(SECTION_ID.footer);
    expect(sectionIdFor("gallery.hero")).toBe(SECTION_ID.galleryIntro);
    expect(sectionIdFor("gallery.outro")).toBe(SECTION_ID.galleryIntro);
  });

  it("maps the template-specific config to the sections that edit it", () => {
    expect(sectionIdFor("modern.hero")).toBe(SECTION_ID.hero);
    expect(sectionIdFor("modern.closing")).toBe(SECTION_ID.modernClosing);
    expect(sectionIdFor("editorial.person")).toBe(SECTION_ID.identity);
    expect(sectionIdFor("editorial.letter")).toBe(SECTION_ID.letter);
    expect(sectionIdFor("godpoetry.hero")).toBe(SECTION_ID.hero);
    expect(sectionIdFor("godpoetry.hero.lines.0")).toBe(SECTION_ID.hero);
    expect(sectionIdFor("godpoetry.hero.dedication")).toBe(SECTION_ID.hero);
    expect(sectionIdFor("template")).toBe(SECTION_ID.template);
    expect(sectionIdFor("theme")).toBe(SECTION_ID.colours);
  });

  it("returns null for a path no section owns", () => {
    expect(sectionIdFor("settings.unknown")).toBeNull();
    expect(sectionIdFor("home.nonexistent.field")).toBeNull();
    expect(sectionIdFor("")).toBeNull();
  });

  it("names every section exactly once", () => {
    // Two sections sharing an id would make the jump land on whichever the
    // browser finds first — silently, and only in one direction.
    const ids = Object.values(SECTION_ID);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
