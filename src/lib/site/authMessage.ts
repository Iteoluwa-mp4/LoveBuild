/**
 * Turning Firebase's error codes into sentences a person can act on.
 *
 * Deliberately kept free of Firebase imports so it can be tested in Node
 * without a browser or a project. `auth.ts` reads the code off whatever was
 * thrown; this file decides what to say about it.
 *
 * Two rules govern the copy:
 *
 *   - Never echo Firebase's message. `auth/invalid-credential` is accurate and
 *     useless; "That email and password don't match" is the same fact, usable.
 *   - Never reveal whether an account exists. Sign-in and password reset fail
 *     the same way for an unknown email as they do for a wrong password, which
 *     is also how Firebase's email-enumeration protection behaves.
 */

export const FALLBACK_AUTH_ERROR = "Couldn't sign in. Try again.";

/**
 * Codes that mean "the person closed the window", not "something is wrong".
 * The login page stays silent for these instead of flashing an error at someone
 * who simply changed their mind.
 */
const CANCELLATION_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
]);

const MESSAGES: Record<string, string> = {
  // Sign-in. The consolidated code is what Firebase returns now, but the two
  // legacy codes are still mapped so an older deployment behaves the same.
  "auth/invalid-credential": "That email and password don't match.",
  "auth/wrong-password": "That email and password don't match.",
  "auth/user-not-found": "That email and password don't match.",
  "auth/user-disabled": "This account has been disabled.",

  // Email problems.
  "auth/invalid-email": "That doesn't look like an email address.",
  "auth/missing-email": "Enter your email address.",

  // Sign-up.
  "auth/email-already-in-use": "That email already has an account. Sign in instead.",
  "auth/weak-password": "Use at least 6 characters for the password.",

  // Throttling and connectivity.
  "auth/too-many-requests": "Too many attempts. Wait a minute, then try again.",
  "auth/network-request-failed": "Couldn't reach the sign-in service. Check your connection.",

  // Project configuration. These are for the owner, not the visitor, but they
  // still have to be legible when something was set up wrong.
  "auth/operation-not-allowed": "That sign-in method isn't enabled for this project.",
  "auth/unauthorized-domain": "This domain isn't authorized for sign-in in the Firebase project.",
  "auth/invalid-api-key": "The Firebase API key is missing or wrong.",
  "auth/configuration-not-found": "The Firebase project configuration couldn't be found.",
  "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups and try again.",

  // Re-authentication.
  "auth/requires-recent-login": "Sign in again to finish this.",
};

export function describeAuthError(code: string | null | undefined): string {
  if (!code) return FALLBACK_AUTH_ERROR;
  return MESSAGES[code] ?? FALLBACK_AUTH_ERROR;
}

/** True when the failure was the person closing the popup, not an error. */
export function isCancellation(code: string | null | undefined): boolean {
  return typeof code === "string" && CANCELLATION_CODES.has(code);
}

/**
 * What to call someone, given a Firebase user.
 *
 * Google supplies a display name. Email/password accounts do not — Firebase sets
 * `displayName` to null — so this falls back to the email's local part rather
 * than showing an empty space: `jane.doe@example.com` becomes "Jane Doe". This
 * is chrome, never stored, and never confused with the recipient's name in the
 * site config.
 */
export function displayNameFor(user: {
  displayName?: string | null;
  email?: string | null;
}): string {
  const named = user.displayName?.trim();
  if (named) return named;

  const email = user.email?.trim();
  if (!email) return "You";

  const local = email.split("@")[0] ?? "";
  const words = local
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "You";

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .slice(0, 40);
}
