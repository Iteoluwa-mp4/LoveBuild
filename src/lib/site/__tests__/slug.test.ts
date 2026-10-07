import { describe, expect, it } from "vitest";

import { siteSchema } from "../schema";
import { checkSlug, publicUrl, slugify } from "../slug";

describe("slugify", () => {
  /**
   * Someone types a name and gets a web address. The rule has to be boring
   * enough that they can guess the link before they ever see it, because the
   * output is permanent — changing it later breaks anything already shared.
   */
  it("makes a readable address from a plain name", () => {
    expect(slugify("For Sarah")).toBe("for-sarah");
    expect(slugify("Sarah")).toBe("sarah");
  });

  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("HAPPY BIRTHDAY")).toBe("happy-birthday");
    expect(slugify("  James and Sarah  ")).toBe("james-and-sarah");
  });

  it("strips punctuation rather than transliterating it", () => {
    expect(slugify("Sarah & James")).toBe("sarah-james");
    expect(slugify("50th!")).toBe("50th");
  });

  it("handles accents and apostrophes", () => {
    // "Zoë" must not come out as "zo-" and "James'" as "james-".
    expect(slugify("Zoë")).toBe("zoe");
    expect(slugify("James'")).toBe("james");
  });

  it("collapses runs of separators and trims the edges", () => {
    expect(slugify("--Sarah--")).toBe("sarah");
    expect(slugify("a  ---  b")).toBe("a-b");
  });

  it("keeps digits", () => {
    expect(slugify("Sarah 30")).toBe("sarah-30");
  });

  it("returns empty when nothing usable survives", () => {
    expect(slugify("")).toBe("");
    expect(slugify("!!!")).toBe("");
    expect(slugify("   ")).toBe("");
  });

  /**
   * The output has to satisfy the schema and the database check constraint,
   * both of which are `^[a-z0-9-]+$`. If slugify ever emits something else, a
   * site becomes uncreatable.
   */
  it("always produces something the schema accepts", () => {
    const inputs = [
      "For Sarah",
      "Zoë & James",
      "!!!",
      "50th Birthday!!!",
      "a-b-c",
      "___",
      "Sarah/James",
    ];

    for (const input of inputs) {
      const slug = slugify(input);
      if (!slug) continue;
      expect(checkSlug(slug).ok, `slugify("${input}") produced ${slug}`).toBe(true);
      expect(() =>
        siteSchema.parse({ slug, theme: "midnight" }),
      ).not.toThrow();
    }
  });
});

describe("checkSlug", () => {
  it("accepts a well-formed slug", () => {
    expect(checkSlug("for-sarah")).toEqual({ ok: true, slug: "for-sarah" });
    expect(checkSlug("sarah30")).toEqual({ ok: true, slug: "sarah30" });
  });

  it("trims before judging, so a stray space is not a rejection", () => {
    expect(checkSlug("  for-sarah  ")).toEqual({ ok: true, slug: "for-sarah" });
  });

  it("explains an empty name rather than saying 'invalid'", () => {
    const result = checkSlug("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/name/i);
  });

  it("explains characters the database would reject", () => {
    const result = checkSlug("For Sarah");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/lower-case/i);
  });

  it("rejects a leading or trailing hyphen", () => {
    expect(checkSlug("-sarah").ok).toBe(false);
    expect(checkSlug("sarah-").ok).toBe(false);
  });

  it("rejects something absurdly long", () => {
    expect(checkSlug("a".repeat(61)).ok).toBe(false);
  });
});

describe("publicUrl", () => {
  it("puts the slug under /s", () => {
    expect(publicUrl("for-sarah")).toBe("/s/for-sarah");
  });
});