import { describe, expect, it } from "vitest";

import {
  FALLBACK_AUTH_ERROR,
  describeAuthError,
  displayNameFor,
  isCancellation,
} from "../authMessage";

/**
 * Auth copy and name fallbacks.
 *
 * These are pure functions on purpose: the Firebase SDK never enters a Node
 * test, but the two things that actually go wrong in a login form — an
 * unhelpful error and an empty greeting — are decided here and can be pinned
 * down without a project, a browser or a network.
 */

describe("describeAuthError", () => {
  it("turns the consolidated credential error into something a person can act on", () => {
    expect(describeAuthError("auth/invalid-credential")).toBe(
      "That email and password don't match.",
    );
  });

  it("keeps the older codes saying the same thing, so an old deployment does not drift", () => {
    expect(describeAuthError("auth/wrong-password")).toBe(
      "That email and password don't match.",
    );
    expect(describeAuthError("auth/user-not-found")).toBe(
      "That email and password don't match.",
    );
  });

  it("says an account already exists without blaming the password", () => {
    expect(describeAuthError("auth/email-already-in-use")).toContain("Sign in instead");
  });

  it("states Firebase's password minimum rather than echoing the server", () => {
    expect(describeAuthError("auth/weak-password")).toContain("6 characters");
  });

  it("asks for a pause when attempts are throttled", () => {
    expect(describeAuthError("auth/too-many-requests")).toContain("Wait a minute");
  });

  it("names a misconfigured domain, because that one is the owner's problem", () => {
    expect(describeAuthError("auth/unauthorized-domain")).toContain("authorized");
  });

  it("falls back to a usable sentence for codes it has never seen", () => {
    expect(describeAuthError("auth/some-new-code")).toBe(FALLBACK_AUTH_ERROR);
    expect(describeAuthError(undefined)).toBe(FALLBACK_AUTH_ERROR);
    expect(describeAuthError(null)).toBe(FALLBACK_AUTH_ERROR);
  });
});

describe("isCancellation", () => {
  it("recognises a closed popup as a decision, not an error", () => {
    expect(isCancellation("auth/popup-closed-by-user")).toBe(true);
    expect(isCancellation("auth/cancelled-popup-request")).toBe(true);
  });

  it("does not treat a real failure as a cancellation", () => {
    expect(isCancellation("auth/invalid-credential")).toBe(false);
    expect(isCancellation(undefined)).toBe(false);
  });
});

describe("displayNameFor", () => {
  it("uses the Google name when there is one", () => {
    expect(displayNameFor({ displayName: "Sarah James", email: "s@example.com" })).toBe(
      "Sarah James",
    );
  });

  it("trims a name that arrived with padding", () => {
    expect(displayNameFor({ displayName: "  Sarah  ", email: null })).toBe("Sarah");
  });

  it("derives a readable name from the email when Firebase has none", () => {
    expect(displayNameFor({ displayName: null, email: "jane.doe@example.com" })).toBe(
      "Jane Doe",
    );
  });

  it("handles plus addressing and underscores without leaking punctuation into the name", () => {
    expect(displayNameFor({ displayName: null, email: "jane_smith+love@example.com" })).toBe(
      "Jane Smith Love",
    );
  });

  it("says something rather than nothing when there is no name and no email", () => {
    expect(displayNameFor({ displayName: "   ", email: null })).toBe("You");
    expect(displayNameFor({})).toBe("You");
  });
});
