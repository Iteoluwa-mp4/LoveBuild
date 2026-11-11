import { type FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useSession } from "../../hooks/useSession";
import {
  MIN_PASSWORD_LENGTH,
  resetPassword,
  signIn,
  signInWithGoogle,
  signUp,
} from "../../lib/site/auth";
import "../../login.css";

/**
 * One screen, two modes.
 *
 * "Sign in" and "Create account" are the same form because they ask the same
 * question — email and password — and only differ in what the button promises.
 * They are *not* merged into one submit: Firebase's email-enumeration protection
 * returns the same error for a wrong password and an unknown address, so
 * "create it if it isn't there" cannot be told apart from "you mistyped your
 * password". A visible toggle is the honest version.
 *
 * Google is offered in both modes. It is the only way to get a real name and
 * photo without asking for one, and it avoids a password entirely for the
 * person who already has a Google account.
 *
 * There is a real "forgot password" now, which the passcode build deliberately
 * did not have: with a passcode held only in one browser there was nowhere to
 * send a reset, and showing a link that could not work was worse than omitting
 * it. Firebase has a server, so the link is honest.
 */
type Mode = "signin" | "signup";

export default function LoginPage() {
  const session = useSession();
  const location = useLocation();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "email" | "google" | "reset">(null);

  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  // Already signed in: no reason to show the form. Rendering before a submit
  // can happen means there is nothing to race with.
  if (session.status === "signed-in") return <Navigate to={from} replace />;

  const switchMode = (next: Mode) => {
    if (busy) return;
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;

    setBusy("email");
    setError(null);
    setNotice(null);

    const result =
      mode === "signin" ? await signIn(email, password) : await signUp(email, password);

    if (!result.ok && !result.cancelled) setError(result.message);
    setBusy(null);
    // On success the session subscription re-renders this page, which redirects
    // above. No manual navigation: it would race the subscription.
  };

  const onGoogle = async () => {
    if (busy) return;

    setBusy("google");
    setError(null);
    setNotice(null);

    const result = await signInWithGoogle();
    if (!result.ok && !result.cancelled) setError(result.message);
    setBusy(null);
  };

  const onReset = async () => {
    if (busy) return;

    setBusy("reset");
    setError(null);
    setNotice(null);

    const result = await resetPassword(email);
    if (result.ok) {
      setNotice("If that email has an account, a reset link is on its way.");
    } else if (!result.cancelled) {
      setError(result.message);
    }
    setBusy(null);
  };

  const creating = mode === "signup";
  const disabled = busy !== null;

  return (
    <main className="login">
      <form className="login-card" onSubmit={onSubmit}>
        <h1 className="login-title">LoveBuilds</h1>

        {session.status === "checking" ? (
          <p className="login-status">Checking…</p>
        ) : (
          <>
            <p className="login-note">
              {creating ? "One email, one password. That's all." : "Sign in to keep building."}
            </p>

            <button
              type="button"
              className="login-google"
              onClick={onGoogle}
              disabled={disabled}
            >
              <GoogleMark />
              Continue with Google
            </button>

            <div className="login-divider">
              <span>or</span>
            </div>

            <label className="login-field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(null);
                  setNotice(null);
                }}
                autoFocus
                required
              />
            </label>

            <label className="login-field">
              <span>Password</span>
              <input
                type={creating ? "new-password" : "current-password"}
                autoComplete={creating ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError(null);
                  setNotice(null);
                }}
                minLength={creating ? MIN_PASSWORD_LENGTH : undefined}
                required
              />
            </label>

            {creating && (
              <p className="login-hint">At least {MIN_PASSWORD_LENGTH} characters.</p>
            )}

            {!creating && (
              <button
                type="button"
                className="login-link login-forgot"
                onClick={onReset}
                disabled={disabled || !email.trim()}
              >
                Forgot your password?
              </button>
            )}

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            {notice && (
              <p className="login-notice" role="status">
                {notice}
              </p>
            )}

            <button
              className="login-submit"
              type="submit"
              disabled={disabled || !email.trim() || password.length === 0}
            >
              {busy === "email"
                ? creating
                  ? "Creating account…"
                  : "Signing in…"
                : creating
                  ? "Create account"
                  : "Sign in"}
            </button>

            <p className="login-switch">
              {creating ? "Already have an account?" : "New here?"}{" "}
              <button
                type="button"
                className="login-link"
                onClick={() => switchMode(creating ? "signin" : "signup")}
                disabled={disabled}
              >
                {creating ? "Sign in" : "Create an account"}
              </button>
            </p>
          </>
        )}
      </form>
    </main>
  );
}

/** The Google mark, inlined so the login screen has no extra network request. */
function GoogleMark() {
  return (
    <svg
      aria-hidden="true"
      width="17"
      height="17"
      viewBox="0 0 48 48"
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
