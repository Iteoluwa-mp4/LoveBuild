import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { isSupabaseConfigured, supabase } from "../lib/supabase";

/**
 * Who is signed in, if anyone.
 *
 * Deliberately reports three states rather than two. A boolean collapses "nobody
 * is signed in" and "we haven't checked yet" into the same value, which is
 * exactly how a protected route flashes its contents for a frame before
 * redirecting to the login page.
 */

export type SessionState =
  | { status: "checking" }
  | { status: "signed-out" }
  | { status: "signed-in"; session: Session; email: string | null };

export function useSession(): SessionState {
  /**
   * `undefined` means "not known yet"; `null` means "known to be nobody".
   *
   * That distinction is the whole point. Deriving the status during render from
   * this one value keeps the effect below free of a synchronous `setState`, which
   * would otherwise fire an extra render on mount and on every config change.
   */
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // With no project there is nobody to sign in, and no point showing a login
    // form that cannot work. Nothing to check, so nothing to listen for.
    if (!isSupabaseConfigured) return;

    const client = supabase();
    let cancelled = false;

    void client.auth.getSession().then(({ data }) => {
      if (!cancelled) setSession(data.session);
    });

    // Keeps the tab in step with sign-in, sign-out and token refresh in another
    // tab, without the page having to be reloaded.
    const { data: subscription } = client.auth.onAuthStateChange((_event, next) => {
      if (!cancelled) setSession(next);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // Derived, not stored. No project configured resolves to signed-out straight
  // away, so offline development does not sit on a loading state forever.
  if (!isSupabaseConfigured) return { status: "signed-out" };
  if (session === undefined) return { status: "checking" };
  if (session === null) return { status: "signed-out" };

  return { status: "signed-in", session, email: session.user.email ?? null };
}

export type SignInResult = { ok: true } | { ok: false; message: string };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  if (!isSupabaseConfigured) {
    return {
      ok: false,
      message: "No Supabase project is configured, so signing in is switched off.",
    };
  }

  const { error } = await supabase().auth.signInWithPassword({ email, password });

  if (!error) return { ok: true };

  // Supabase returns the same message for an unknown email and a wrong password,
  // which is deliberate on their part and worth keeping: telling someone which
  // half they got right turns this into an account-enumeration oracle.
  return { ok: false, message: "That email and password didn't match." };
}