import { type FormEvent, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Navigate, useLocation } from "react-router-dom";

import { useSession } from "../../hooks/useSession";
import { FALLBACK_AUTH_ERROR } from "../../lib/site/authMessage";
import {
  MIN_PASSWORD_LENGTH,
  isFirebaseConfigured,
  resetPassword,
  signIn,
  signInWithGoogle,
  signUp,
} from "../../lib/site/auth";
import "../../auth-screen.css";

type Mode = "signup" | "login";
type Busy = null | "email" | "google" | "reset";

/**
 * The front door.
 *
 * Two modes because sign-in and create-account ask the same two questions but
 * promise different things. They are never merged behind one button: Firebase's
 * email-enumeration protection returns the same error for an unknown address and
 * a wrong password, so "create it if it isn't there" cannot be told apart from
 * "you mistyped your password". A visible toggle is the honest version.
 *
 * Every action below goes through `lib/site/auth.ts`. On success the session
 * subscription in `useSession` re-renders this screen and the redirect above
 * takes over; navigating manually as well would race that subscription. Google
 * can fall back to a full-page redirect on browsers that block popups, which is
 * why success is left to the subscription rather than assumed here.
 */
export default function AuthScreen() {
  const session = useSession();
  const location = useLocation();
  const configured = isFirebaseConfigured();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  /**
   * `createUserWithEmailAndPassword` signs the new account in immediately, so
   * the session subscription reports success while the display name and the
   * verification email are still being written. Holding the redirect until this
   * request has finished avoids sending the shelf a half-created profile and
   * avoids an unmount racing the form's own success path.
   */
  const [finishingSignup, setFinishingSignup] = useState(false);

  const rootRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const switchingRef = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const context = gsap.context(() => {
      gsap.fromTo(
        ".auth-art > *",
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.75, stagger: 0.06, ease: "power3.out" },
      );
      gsap.fromTo(
        ".auth-form-panel > *",
        { opacity: 0, x: 20 },
        { opacity: 1, x: 0, duration: 0.65, stagger: 0.08, ease: "power3.out", delay: 0.2 },
      );
      gsap.to(".art-ring-one", { rotate: 360, duration: 28, repeat: -1, ease: "none" });
      gsap.to(".art-ring-two", { rotate: -360, duration: 35, repeat: -1, ease: "none" });
    }, root);

    return () => context.revert();
  }, []);

  /**
   * Where a protected route wanted to send the person before `RequireAuth`
   * interrupted them. The shelf is the default because a new account has no
   * site to edit yet.
   */
  const from = (location.state as { from?: string } | null)?.from ?? "/profile";

  if (session.status === "signed-in" && !finishingSignup) {
    return <Navigate to={from} replace />;
  }

  const creating = mode === "signup";
  const checking = session.status === "checking";
  const disabled = busy !== null || checking || !configured;

  const clearFeedback = () => {
    setError(null);
    setNotice(null);
  };

  const switchMode = (nextMode: Mode) => {
    if (nextMode === mode || busy || switchingRef.current) return;

    clearFeedback();
    if (!formRef.current) {
      setMode(nextMode);
      return;
    }

    switchingRef.current = true;
    gsap.to(formRef.current, {
      opacity: 0,
      x: nextMode === "login" ? 18 : -18,
      duration: 0.18,
      onComplete: () => {
        setMode(nextMode);
        if (!formRef.current) {
          switchingRef.current = false;
          return;
        }
        gsap.fromTo(
          formRef.current,
          { opacity: 0, x: nextMode === "login" ? -18 : 18 },
          {
            opacity: 1,
            x: 0,
            duration: 0.35,
            ease: "power2.out",
            onComplete: () => {
              switchingRef.current = false;
            },
          },
        );
      },
    });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    if (!configured) {
      setError(
        "Sign-in isn't configured for this build. Add the Firebase settings to .env.local.",
      );
      return;
    }

    setBusy("email");
    clearFeedback();
    if (creating) setFinishingSignup(true);

    try {
      const result = creating
        ? await signUp(email, password, name)
        : await signIn(email, password);

      if (!result.ok && !result.cancelled) setError(result.message);
    } catch {
      // `signIn`/`signUp` turn Firebase errors into sentences themselves; this
      // only catches a failure before Firebase is reached, such as an invalid
      // project configuration. Either way the form must not stay busy.
      setError(FALLBACK_AUTH_ERROR);
    } finally {
      if (creating) setFinishingSignup(false);
      setBusy(null);
    }
    // On success the session subscription re-renders this page, which redirects
    // above. No manual navigation: it would race the subscription.
  };

  const onGoogle = async () => {
    if (busy) return;

    setBusy("google");
    clearFeedback();

    try {
      const result = await signInWithGoogle();
      if (!result.ok && !result.cancelled) setError(result.message);
    } catch {
      setError(FALLBACK_AUTH_ERROR);
    } finally {
      setBusy(null);
    }
  };

  const onReset = async () => {
    if (busy) return;

    setBusy("reset");
    clearFeedback();

    try {
      const result = await resetPassword(email);
      if (result.ok) {
        // The same sentence whether or not the address exists: saying otherwise
        // would turn this form into a way to test which emails have accounts.
        setNotice("If that email has an account, a reset link is on its way.");
      } else if (!result.cancelled) {
        setError(result.message);
      }
    } catch {
      setError(FALLBACK_AUTH_ERROR);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className={`auth-screen ${mode}`} ref={rootRef}>
      <section className="auth-shell">
        <FilmIllustration />
        <div className="auth-form-panel" ref={formRef}>
          <header className="auth-header">
            <span className="auth-brand">
              LoveBuilds<span>.</span>
            </span>
            <span className="auth-issue">stories, kept</span>
          </header>

          <div className="auth-content">
            <div className="auth-tabs" role="group" aria-label="Authentication mode">
              <button
                type="button"
                className={mode === "signup" ? "active" : ""}
                onClick={() => switchMode("signup")}
                aria-pressed={mode === "signup"}
                disabled={disabled}
              >
                Create account
              </button>
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => switchMode("login")}
                aria-pressed={mode === "login"}
                disabled={disabled}
              >
                Sign in
              </button>
            </div>

            {!configured && (
              <p className="auth-alert" role="alert">
                This build is missing its Firebase settings, so sign-in cannot work yet. Add
                the four <code>VITE_FIREBASE_*</code> values to the host environment and
                redeploy.
              </p>
            )}

            {checking && (
              <p className="auth-status" role="status">
                Checking your session…
              </p>
            )}

            <form onSubmit={onSubmit} aria-busy={busy !== null}>
              <p className="auth-eyebrow">{creating ? "hello, friend" : "welcome back"}</p>
              <h1>
                {creating ? (
                  <>
                    Make room
                    <br />
                    <em>for wonder.</em>
                  </>
                ) : (
                  <>
                    Good to see
                    <br />
                    <em>you again.</em>
                  </>
                )}
              </h1>
              <p className="auth-description">
                {creating
                  ? "Save the moments worth replaying, and share them with the people who make them matter."
                  : "Sign in to return to your saved stories, private screenings, and favorite frames."}
              </p>

              {creating && (
                <label>
                  your name
                  <input
                    name="name"
                    autoComplete="name"
                    placeholder="What should we call you?"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      clearFeedback();
                    }}
                    maxLength={80}
                    required
                  />
                </label>
              )}

              <label>
                email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearFeedback();
                  }}
                  maxLength={254}
                  autoFocus
                  required
                />
              </label>

              <label>
                password
                <input
                  name="password"
                  type="password"
                  autoComplete={creating ? "new-password" : "current-password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearFeedback();
                  }}
                  minLength={creating ? MIN_PASSWORD_LENGTH : undefined}
                  required
                />
              </label>

              {creating && (
                <p className="auth-hint">At least {MIN_PASSWORD_LENGTH} characters.</p>
              )}

              {!creating && (
                <button
                  type="button"
                  className="forgot"
                  onClick={onReset}
                  disabled={disabled}
                >
                  {busy === "reset" ? "sending reset link…" : "forgot your password?"}
                </button>
              )}

              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}

              {notice && (
                <p className="auth-notice" role="status">
                  {notice}
                </p>
              )}

              <button className="primary-button" type="submit" disabled={disabled}>
                {busy === "email"
                  ? creating
                    ? "Creating account…"
                    : "Signing in…"
                  : creating
                    ? "Start my story"
                    : "Take me in"}
                <span>↗</span>
              </button>

              <div className="auth-divider">
                <span>or continue with</span>
              </div>

              <button
                type="button"
                className="auth-google"
                onClick={onGoogle}
                disabled={disabled}
              >
                <GoogleMark />
                {busy === "google" ? "Opening Google…" : "Continue with Google"}
              </button>
            </form>
          </div>

          <footer className="auth-footer">
            <span>made for the soft-hearted</span>
            <span>© 2026 LoveBuilds</span>
          </footer>
        </div>
      </section>
    </main>
  );
}

/** The poster-shaped half. Decorative, so it is hidden from assistive tech. */
function FilmIllustration() {
  return (
    <div className="auth-art" aria-hidden="true">
      <div className="auth-art-grid" />
      <div className="art-sun" />
      <div className="art-ring art-ring-one" />
      <div className="art-ring art-ring-two" />
      <div className="film-strip film-strip-one">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="film-strip film-strip-two">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="camera-shape">
        <span className="camera-lens" />
        <span className="camera-top" />
        <span className="camera-leg camera-leg-one" />
        <span className="camera-leg camera-leg-two" />
      </div>
      <div className="popcorn-bowl">
        <span className="popcorn popcorn-one" />
        <span className="popcorn popcorn-two" />
        <span className="popcorn popcorn-three" />
        <span className="bowl" />
      </div>
      <div className="art-copy">
        <span className="art-kicker">a little space</span>
        <strong>
          for your
          <br />
          <em>next story.</em>
        </strong>
        <span className="art-note">watch · share · remember</span>
      </div>
      <div className="art-star star-one">✦</div>
      <div className="art-star star-two">✦</div>
      <div className="art-star star-three">✧</div>
    </div>
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
