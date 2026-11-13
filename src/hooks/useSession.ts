import { useEffect, useState } from "react";
import { getRedirectResult, onAuthStateChanged, type Auth, type User } from "firebase/auth";

import { displayNameFor } from "../lib/site/authMessage";
import { getFirebaseAuth, isFirebaseConfigured } from "../lib/site/firebase";

/**
 * Who is in the editor, if anyone.
 *
 * Deliberately reports three states rather than two. A boolean collapses "nobody
 * is signed in" and "we haven't checked yet" into the same value, which is exactly
 * how a protected route flashes its contents for a frame before redirecting to
 * the login page.
 *
 * With Firebase configured, the first `onAuthStateChanged` callback resolves
 * "checking". Without it, development keeps the local open mode it has always
 * had — no login screen, no project, no setup. That fallback is a feature of
 * the development build, not a security claim. Production fails closed to the
 * login screen instead of silently creating an anonymous local workspace.
 */

export type SessionUser = {
  uid: string;
  email: string | null;
  /** Google's name, or a readable one derived from the email. */
  name: string;
  photoURL: string | null;
  emailVerified: boolean;
  /** Which provider the account was created with. */
  provider: "google" | "password" | "other";
};

export type SessionState =
  | { status: "checking" }
  | { status: "signed-out" }
  /** `local` means no Firebase project is configured; the app is open. */
  | { status: "signed-in"; method: "local"; user: null }
  | { status: "signed-in"; method: "firebase"; user: SessionUser };

function toSessionUser(user: User): SessionUser {
  const provider = user.providerData.some((entry) => entry.providerId === "google.com")
    ? "google"
    : user.providerData.some((entry) => entry.providerId === "password")
      ? "password"
      : "other";

  return {
    uid: user.uid,
    email: user.email,
    name: displayNameFor(user),
    photoURL: user.photoURL,
    emailVerified: user.emailVerified,
    provider,
  };
}

export function useSession(): SessionState {
  const configured = isFirebaseConfigured();

  /**
   * `undefined` means "Firebase hasn't answered yet"; `null` means "answered:
   * nobody". That distinction is what lets the route gate wait instead of
   * bouncing a signed-in user to the login page on refresh.
   */
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    let auth: Auth | null;
    try {
      auth = getFirebaseAuth();
    } catch {
      // A malformed project config must not leave the app stuck on "Checking…"
      // forever. Treat it as signed out; the login page will explain the error
      // when the first action is attempted.
      setUser(null);
      return;
    }
    if (!auth) return;

    /*
      If a previous Google sign-in fell back to a redirect, the result lands
      here. Its failure is not fatal: the listener below still reports the real
      session, and the login page can retry. Swallowing it keeps a stale redirect
      error from blocking a perfectly good session.
    */
    void getRedirectResult(auth).catch(() => {});

    try {
      return onAuthStateChanged(auth, (next) => {
        setUser(next ? toSessionUser(next) : null);
      });
    } catch {
      setUser(null);
      return;
    }
  }, []);

  /*
    No project configured. In development the editor stays open, exactly as
    before, so a fresh clone works with no `.env.local`. A production build
    must not turn a missing Firebase setting into an anonymous workspace, so
    it fails closed and lets the login page explain the missing configuration.
  */
  if (!configured) {
    return import.meta.env.DEV
      ? { status: "signed-in", method: "local", user: null }
      : { status: "signed-out" };
  }

  if (user === undefined) return { status: "checking" };
  if (user === null) return { status: "signed-out" };

  return { status: "signed-in", method: "firebase", user };
}
