import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from "firebase/auth";

import { describeAuthError, isCancellation } from "./authMessage";
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
 * Only email and password. A name is not requested: Google supplies one for its
 * accounts, and for everyone else `displayNameFor` derives something readable
 * from the email until they have a reason to change it.
 *
 * The verification email is best-effort. It is a notice in the dashboard, not a
 * gate, so failing to send it must not fail the sign-up that just succeeded.
 */
export async function signUp(email: string, password: string): Promise<AuthResult> {
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
