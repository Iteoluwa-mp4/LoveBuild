import { useEffect, useState } from "react";

import { isPasscodeSet, isUnlocked, subscribe } from "../lib/site/auth";
import type { AuthResult } from "../lib/site/auth";

/**
 * Who is in the editor, if anyone.
 *
 * Deliberately reports three states rather than two. A boolean collapses "nobody
 * is signed in" and "we haven't checked yet" into the same value, which is exactly
 * how a protected route flashes its contents for a frame before redirecting to the
 * login page.
 *
 * The session is local: see `lib/site/auth.ts`, which is honest about being a gate
 * rather than a lock. What survives here is the *contract* — three states, one
 * hook — so that when a real backend arrives this file points at it and nothing
 * above changes.
 */

export type SessionState =
  | { status: "checking" }
  | { status: "signed-out" }
  /** `local` means a browser-local passcode; a real backend would name itself. */
  | { status: "signed-in"; method: "local" };

export function useSession(): SessionState {
  /**
   * `undefined` means "not known yet"; a boolean means "known".
   *
   * That distinction is the whole point. Deriving the status during render from
   * this one value keeps the effect below free of a synchronous `setState`, which
   * would otherwise fire an extra render on mount and on every config change.
   */
  const [unlocked, setUnlocked] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const read = () => setUnlocked(isUnlocked());
    read();

    // Signing out in another tab, or in the same tab from the dashboard bar, has
    // to move this one too — otherwise the login page appears to do nothing.
    return subscribe(read);
  }, []);

  if (unlocked === undefined) return { status: "checking" };

  // A passcode that has never been set means there is nobody to authenticate, and
  // no point showing a login form that cannot be satisfied. This is the normal
  // state on a fresh browser.
  if (!unlocked && !isPasscodeSet()) return { status: "signed-in", method: "local" };

  if (!unlocked) return { status: "signed-out" };

  return { status: "signed-in", method: "local" };
}

export type { AuthResult as SignInResult };