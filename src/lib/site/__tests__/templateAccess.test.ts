import { describe, expect, it } from "vitest";

import { isPrivateTemplate, isTemplateAvailable } from "../templateAccess";

/**
 * The private-template gate.
 *
 * This is an authoring rule, not a rendering one: the published page stays
 * public so the person receiving the gift never needs an account. These tests
 * pin the two halves of that — the owner is allowed, everyone else fails
 * closed — rather than the dashboard's particular rendering of the list.
 */
describe("private template access", () => {
  it("offers the God Poetry template to its owner", () => {
    expect(isTemplateAvailable("godpoetry", "youcantseemeirl@gmail.com")).toBe(true);
  });

  it("matches the owner's email regardless of case or surrounding space", () => {
    expect(isTemplateAvailable("godpoetry", "  YouCantSeeMeIRL@Gmail.com ")).toBe(true);
  });

  it("recognizes the owner by uid even when the email differs", () => {
    expect(
      isTemplateAvailable(
        "godpoetry",
        "another-spelling@gmail.com",
        "ZQ2aXAydhyN36I8ngH33WAxlZ7u2",
      ),
    ).toBe(true);
    expect(
      isTemplateAvailable(
        "godpoetry",
        "youcantseemeirl@gmail.com",
        "some-other-firebase-uid",
      ),
    ).toBe(true);
    expect(isTemplateAvailable("godpoetry", "someone.else@gmail.com", "not-the-owner")).toBe(
      false,
    );
  });

  it("fails closed for another account, a missing email, or no session", () => {
    expect(isTemplateAvailable("godpoetry", "someone.else@gmail.com")).toBe(false);
    expect(isTemplateAvailable("godpoetry", "")).toBe(false);
    expect(isTemplateAvailable("godpoetry", null)).toBe(false);
    expect(isTemplateAvailable("godpoetry", undefined)).toBe(false);
  });

  it("leaves every public template available to everyone", () => {
    for (const template of ["editorial", "modern", "scrapbook", "unknown"]) {
      expect(isTemplateAvailable(template, "someone.else@gmail.com")).toBe(true);
      expect(isTemplateAvailable(template, null)).toBe(true);
    }
  });

  it("knows which templates are restricted", () => {
    expect(isPrivateTemplate("godpoetry")).toBe(true);
    expect(isPrivateTemplate("editorial")).toBe(false);
    expect(isPrivateTemplate("modern")).toBe(false);
    expect(isPrivateTemplate("scrapbook")).toBe(false);
    expect(isPrivateTemplate("not-a-template")).toBe(false);
  });
});
