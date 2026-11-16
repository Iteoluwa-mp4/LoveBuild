import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";

import { FALLBACK_AUTH_ERROR, describeAuthError, isCancellation } from "./authMessage";
import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";

/**
 * Authentication, through Firebase.
 *
 * This replaces the local passcode. The passcode was honestly described as a
 * gate rather than a lock: it decided who got the editor, while the data sat in
 * the browser for anyone with the machine to read. Firebase Auth gives us real
 * accounts, real password resets and a stable `uid` — the owner key that the
 * hosted repository will use.
 *
 * **What this does not do yet.** Sites still live in localStorage, so signing in
 * does not make them private. The lock arrives when the repository goes remote;
 * until then this is a real identity in front of browser-local data. The copy in
 * the app must keep saying so rather than implying more.
 *
 * ## Shape
 *
 * Every action returns `AuthResult` instead of throwing. The login form is the
 * only caller, and it needs one thing: either "it worked" or a sentence to show.
 * Firebase's error codes are mapped in `authMessage.ts`.
 */

export type AuthResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      /** True when the person closed the popup. Show nothing in that case. */
      cancelled?: boolean;
    };

/** Firebase's own minimum. The UI states it rather than letting the server say no. */
export const MIN_PASSWORD_LENGTH = 6;

export { isFirebaseConfigured };

/** Reads `code` off a thrown Firebase error without trusting its shape. */
function readCode(cause: unknown): string | undefined {
  if (typeof cause !== "object" || cause === null || !("code" in cause)) return undefined;
  const { code } = cause as { code?: unknown };
  return typeof code === "string" ? code : undefined;
}

function failure(cause: unknown): AuthResult {
  const code = readCode(cause);
  if (isCancellation(code)) return { ok: false, message: "", cancelled: true };
  return { ok: false, message: describeAuthError(code) };
}

function notConfigured(): AuthResult {
  return {
    ok: false,
    message: "Sign-in isn't configured for this build. Add the Firebase settings to .env.local.",
  };
}

/** Sign in with an email and password. */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  const auth = getFirebaseAuth();
  if (!auth) return notConfigured();

  const address = email.trim();
  if (!address) return { ok: false, message: "Enter your email address." };
  if (!password) return { ok: false, message: "Enter your password." };

  try {
    await signInWithEmailAndPassword(auth, address, password);
    return { ok: true };
  } catch (cause) {
    return failure(cause);
  }
}

/**
 * Create an account.
 *
 * The display name is optional. A name is not required to authenticate, but the
 * sign-up form asks for one because the dashboard greets people by it; when it is
 * supplied it is written to the Firebase profile so it follows the account
 * rather than living only in the form. Google supplies its own name, and for
 * everyone else `displayNameFor` still derives something readable from the email
 * until they have a reason to change it.
 *
 * The verification email is best-effort. It is a notice in the dashboard, not a
 * gate, so failing to send it must not fail the sign-up that just succeeded.
 */
export async function signUp(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthResult> {
  const auth = getFirebaseAuth();
  if (!auth) return notConfigured();

  const address = email.trim();
  if (!address) return { ok: false, message: "Enter your email address." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `Use at least ${MIN_PASSWORD_LENGTH} characters for the password.`,
    };
  }

  try {
    const { user } = await createUserWithEmailAndPassword(auth, address, password);
    if (displayName?.trim()) {
      try {
        await updateProfile(user, { displayName: displayName.trim() });
        /*
          Refresh the token after changing the profile. `updateProfile` updates
          the user record but does not necessarily notify token listeners, and
          `useSession` follows those listeners — without this the shelf greets a
          new account by its email-derived name until the next reload.
        */
        await user.getIdToken(true);
      } catch {
        /* The account exists; a missing name falls back to the email. */
      }
    }
    void sendEmailVerification(user).catch(() => {
      /* A missing verification email is not a failed account. */
    });
    return { ok: true };
  } catch (cause) {
    return failure(cause);
  }
}

/**
 * Sign in with Google.
 *
 * Popup first because it keeps the person on the page. Some mobile browsers
 * block it, so that specific failure falls back to a redirect rather than
 * telling someone to go and change a setting they cannot find.
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  const auth = getFirebaseAuth();
  if (!auth) return notConfigured();

  const provider = new GoogleAuthProvider();
  // Always let them pick, so a shared computer does not silently reuse an account.
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    await signInWithPopup(auth, provider);
    return { ok: true };
  } catch (cause) {
    if (readCode(cause) === "auth/popup-blocked") {
      try {
        await signInWithRedirect(auth, provider);
        return { ok: true };
      } catch (redirectCause) {
        return failure(redirectCause);
      }
    }
    return failure(cause);
  }
}

/**
 * Send a password reset link.
 *
 * Reports success even when no account matched, because the alternative leaks
 * which addresses are registered. Firebase's enumeration protection already
 * behaves this way; this makes sure our copy does too.
 */
export async function resetPassword(email: string): Promise<AuthResult> {
  const auth = getFirebaseAuth();
  if (!auth) return notConfigured();

  const address = email.trim();
  if (!address) return { ok: false, message: "Enter your email address first." };

  try {
    await sendPasswordResetEmail(auth, address);
    return { ok: true };
  } catch (cause) {
    if (readCode(cause) === "auth/user-not-found") return { ok: true };
    return failure(cause);
  }
}

/** Re-send the verification email for the signed-in account. */
export async function resendVerification(): Promise<AuthResult> {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!auth || !user) return { ok: false, message: "Sign in first." };
  if (user.emailVerified) return { ok: true };

  try {
    await sendEmailVerification(user);
    return { ok: true };
  } catch (cause) {
    return failure(cause);
  }
}

/**
 * Re-prove ownership of the signed-in account without ending the session.
 *
 * This is the confirmation step of account deletion, and it runs *before* any
 * data is touched — so a wrong password or a closed window costs nothing.
 * It is also what makes Firebase allow the deletion at all: `deleteUser`
 * refuses from a session that has not authenticated recently, and rather than
 * hoping the threshold passes, asking here makes the outcome deterministic.
 *
 * Password accounts need `password`. Google accounts open the popup and ignore
 * it. Any other provider has nothing we can re-prove from this side and passes
 * through; if Firebase still wants a fresh login, `removeAccount` reports that
 * after the data is gone, which is recoverable rather than silent.
 */
export async function reauthenticate(password?: string): Promise<AuthResult> {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!auth || !user) return { ok: false, message: "Sign in first." };

  const google = user.providerData.some((entry) => entry.providerId === "google.com");
  if (google) {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await reauthenticateWithPopup(user, provider);
      return { ok: true };
    } catch (cause) {
      /*
        No redirect fallback here, unlike sign-in. A redirect abandons the
        delete flow mid-flight and returns to a page that has forgotten what
        it was doing, so this path says what happened instead.
      */
      return reauthFailure(cause);
    }
  }

  const passwordAccount = user.providerData.some((entry) => entry.providerId === "password");
  if (!passwordAccount) return { ok: true };
  if (!password) {
    return { ok: false, message: "Enter your password to confirm. Nothing has been deleted." };
  }
  if (!user.email) {
    return { ok: false, message: "This account has no email address to confirm with." };
  }

  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    return { ok: true };
  } catch (cause) {
    return reauthFailure(cause);
  }
}

/**
 * A failed re-authentication, in the context this flow needs.
 *
 * The sign-in copy is deliberately generic — it must not reveal whether an
 * account exists. Here the person is already signed in, so "that email and
 * password don't match" would be strange; the password is the only thing
 * being checked, and saying so is both true and kinder. Every message ends
 * by stating that nothing was deleted, because that is the fact someone
 * most wants at this moment.
 */
function reauthFailure(cause: unknown): AuthResult {
  const code = readCode(cause);
  if (isCancellation(code)) return { ok: false, message: "", cancelled: true };

  const detail =
    code === "auth/wrong-password" || code === "auth/invalid-credential"
      ? "That password didn't match."
      : describeAuthError(code) === FALLBACK_AUTH_ERROR
        ? "Couldn't confirm it's you."
        : describeAuthError(code);

  return { ok: false, message: `${detail} Nothing has been deleted.` };
}

/**
 * Delete the signed-in identity itself.
 *
 * Call this only once the account's data is already gone. Every failure
 * message therefore opens by stating that state — the sites are deleted, the
 * account is not — instead of pretending nothing has happened, and the
 * recovery path for Firebase's recent-login demand is spelled out rather than
 * left as a code.
 */
export async function removeAccount(): Promise<AuthResult> {
  const user = getFirebaseAuth()?.currentUser;
  if (!user) {
    return {
      ok: false,
      message: "Your sites are already deleted, but this session has ended. Sign in again to delete the account.",
    };
  }

  try {
    await deleteUser(user);
    return { ok: true };
  } catch (cause) {
    const code = readCode(cause);
    const detail =
      code === "auth/requires-recent-login"
        ? "Sign out, sign back in, and delete the account again to finish."
        : describeAuthError(code) === FALLBACK_AUTH_ERROR
          ? "Try again."
          : describeAuthError(code);

    return {
      ok: false,
      message: `Your sites are already deleted — the account is still here. ${detail}`,
    };
  }
}

/**
 * Sign out.
 *
 * Projects are untouched — this only ends the session. `RequireAuth` reacts to
 * the change and sends the person back to the login page.
 */
export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth();
  if (!auth) return;
  try {
    await firebaseSignOut(auth);
  } catch {
    /* Nothing useful to do; the subscription will settle on the truth. */
  }
}
