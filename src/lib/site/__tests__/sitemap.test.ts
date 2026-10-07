import { describe, expect, it } from "vitest";

import { emptySite } from "../default";
import type { Chapter, Site } from "../schema";
import { MAX_SITEMAP_CHAPTERS, buildSitemap, editUrl } from "../sitemap";

function chapter(id: string, title: string): Chapter {
  return { id, label: "", title, blurb: undefined, films: [], stills: [] };
}

function siteWith(chapters: Chapter[]): Site {
  const site = emptySite("their-name");
  site.gallery.chapters = chapters;
  return site;
}

describe("buildSitemap", () => {
  it("always offers the two real pages", () => {
    const map = buildSitemap(emptySite("their-name"), "/s/their-name");
    expect(map.pages).toEqual([
      { label: "Home", to: "/s/their-name" },
      { label: "The gallery", to: "/s/their-name/gallery" },
    ]);
  });

  it("keeps every link under the site's own base path", () => {
    const map = buildSitemap(
      siteWith([chapter("one", "One"), chapter("two", "Two")]),
      "/s/their-name",
    );

    for (const link of [...map.pages, ...map.chapters]) {
      expect(link.to.startsWith("/s/their-name"), `${link.to} escapes the site`).toBe(true);
    }
  });

  /**
   * Chapters all live on the single gallery page, so they are anchors into it.
   * They need an `id` on the section to land on, which is why GalleryPage sets
   * one — without it every chapter link in the footer would silently do nothing.
   */
  it("links chapters as anchors into the gallery", () => {
    const map = buildSitemap(siteWith([chapter("first-meeting", "First meeting")]), "/s/x");
    expect(map.chapters).toEqual([
      { label: "01. First meeting", to: "/s/x/gallery#first-meeting" },
    ]);
  });

  it("derives the label from position when a chapter has none of its own", () => {
    const map = buildSitemap(siteWith([chapter("a", "A"), chapter("b", "B"), chapter("c", "C")]), "/s/x");
    expect(map.chapters.map((c) => c.label)).toEqual(["01. A", "02. B", "03. C"]);
  });

  it("falls back to 'Untitled' for a chapter with no title", () => {
    const map = buildSitemap(siteWith([chapter("a", "")]), "/s/x");
    expect(map.chapters[0]?.label).toBe("01. Untitled");
  });

  it("has no chapter list when there are no chapters", () => {
    const map = buildSitemap(siteWith([]), "/s/x");
    expect(map.chapters).toEqual([]);
    expect(map.chaptersTruncated).toBe(false);
  });

  /**
   * Chapter count is unbounded. A footer that grows to forty links stops being
   * navigation and becomes an index, so the list is capped and says so.
   */
  it("caps the chapter list and reports the truncation", () => {
    const many = Array.from({ length: 14 }, (_, i) => chapter(`c${i}`, `Chapter ${i}`));
    const map = buildSitemap(siteWith(many), "/s/x");

    expect(map.chapters).toHaveLength(MAX_SITEMAP_CHAPTERS);
    expect(map.chaptersTruncated).toBe(true);
    expect(map.chapters[0]?.label).toBe("01. Chapter 0");
  });

  it("does not report truncation when it is not needed", () => {
    const exact = Array.from({ length: MAX_SITEMAP_CHAPTERS }, (_, i) => chapter(`c${i}`, `C${i}`));
    expect(buildSitemap(siteWith(exact), "/s/x").chaptersTruncated).toBe(false);
  });

  it("keeps a hyphenated slug intact", () => {
    const map = buildSitemap(emptySite("sarah-and-james"), "/s/sarah-and-james");
    expect(map.pages[1]?.to).toBe("/s/sarah-and-james/gallery");
  });
});

describe("editUrl", () => {
  /**
   * Carries the slug on purpose. `/dashboard` would land on whichever site was
   * edited most recently, so with more than one client it is the wrong dashboard
   * — and wrong in a way that looks like data belonging to someone else.
   */
  it("points at this specific site's dashboard", () => {
    expect(editUrl("their-name")).toBe("/dashboard/their-name");
  });

  it("differs per client", () => {
    expect(editUrl("uncle-one")).not.toBe(editUrl("uncle-two"));
  });
});