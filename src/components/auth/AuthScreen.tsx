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
  /** The privacy policy dialog. One source for both ways in: the footer link
   *  and the consent line under the sign-up form. */
  const [privacyOpen, setPrivacyOpen] = useState(false);
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

              {creating && (
                <p className="auth-consent">
                  By creating an account you agree to our{" "}
                  <button type="button" onClick={() => setPrivacyOpen(true)}>
                    privacy policy
                  </button>
                  .
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
            <button type="button" className="auth-privacy-link" onClick={() => setPrivacyOpen(true)}>
              privacy policy
            </button>
            <span>© 2026 LoveBuilds</span>
          </footer>
        </div>
      </section>

      <PrivacyPolicy open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </main>
  );
}

/**
 * The privacy policy, as a dialog on the front door rather than a route.
 *
 * It lives on this page — not at `/privacy` — because this is the only page
 * that needs it: someone reading it is about to hand over an email address,
 * and sending them to another route to find out what happens to it is the
 * wrong order. A dialog also keeps the answer one tap away from the field it
 * applies to, in both modes of this screen.
 *
 * The copy is a draft and says so in the card. LoveBuilds is still being
 * built; a policy that pretends to be final is worse than one that shows when
 * it was written.
 *
 * Focus behaviour is the small honest version of a modal: focus moves to the
 * close button, Tab cycles inside the card, Escape and the backdrop close it,
 * and focus returns to whatever opened it.
 */
function PrivacyPolicy({ open, onClose }: { open: boolean; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  /**
   * The latest `onClose`, read from inside the keydown listener.
   *
   * Held in a ref so the effect below depends only on `open`: the parent
   * re-renders on every keystroke in the form behind the dialog, and an effect
   * keyed on an inline arrow would re-run — yanking focus back to the close
   * button — for every character typed.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const card = cardRef.current;
      if (!card) return;
      const focusable = card.querySelectorAll<HTMLElement>("button, a[href]");
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // Past either edge, wrap to the other side: Tab cannot walk out of the
      // card and into the form sitting behind the backdrop.
      if (event.shiftKey && (active === first || !card.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !card.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="privacy-overlay"
      onMouseDown={(event) => {
        // mousedown rather than click: a text selection that starts inside the
        // card and ends on the backdrop must not close the policy mid-read.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="privacy-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-title"
        ref={cardRef}
      >
        <div className="privacy-head">
          <div>
            <p className="privacy-kicker">
              <span className="privacy-draft">draft</span>
              lovebuilds · privacy
            </p>
            <h2 id="privacy-title">Your privacy, in plain words.</h2>
          </div>
          <button
            type="button"
            className="privacy-close"
            onClick={onClose}
            aria-label="Close privacy policy"
            ref={closeRef}
          >
            ✕
          </button>
        </div>

        <p className="privacy-intro">
          LoveBuilds keeps stories between the people they are for. This is a draft of
          how it handles that — written while the product is still being built, and it
          will be reviewed again before launch.
        </p>

        {PRIVACY_SECTIONS.map((section) => (
          <section key={section.heading}>
            <h3>{section.heading}</h3>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.points && (
              <ul>
                {section.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <p className="privacy-updated">last updated 16 november 2026 · draft</p>
      </div>
    </div>
  );
}

type PolicySection = {
  heading: string;
  paragraphs?: string[];
  points?: string[];
};

/**
 * The draft policy itself.
 *
 * Data rather than markup, so the wording can be reviewed and replaced in one
 * place — this is the text a lawyer will eventually read, and it should not be
 * buried inside JSX. Everything here describes what the app *does* today:
 * Firebase Authentication, Cloudinary for media, the Neon database behind the
 * same-origin `/api` route, and browser storage for drafts. It also states the
 * absences that matter — no advertising, no analytics — because leaving those
 * unspoken would be its own kind of lie.
 */
const PRIVACY_SECTIONS: PolicySection[] = [
  {
    heading: "What we collect",
    paragraphs: [
      "Your account: the email address you sign up with, the display name you choose, and your password. The password is held by Firebase Authentication — we never see it in plain text.",
    ],
    points: [
      "Google sign-in shares your name, email address and profile picture from Google.",
      "What you make: the sites you write — copy, photographs and videos you upload — plus the small drafts the editor keeps so a refresh does not lose your work.",
    ],
  },
  {
    heading: "How it is used",
    paragraphs: [
      "To run LoveBuilds: sign you in, save your sites, show your previews, publish what you choose to publish, and send a password reset when you ask for one.",
      "And for nothing else. No advertising, no third-party analytics or tracking pixels, and your content is never sold.",
    ],
  },
  {
    heading: "What is public",
    paragraphs: [
      "Publishing puts a site at its link, where anyone with the link can read it — that is the point of publishing. Drafts are never public.",
    ],
  },
  {
    heading: "Where it is kept",
    points: [
      "Accounts and sessions: Firebase, on Google Cloud.",
      "Photographs and videos: Cloudinary, served from its CDN.",
      "Your sites: our database, reached through this app's own API — or this browser's local storage in a development build with no backend configured.",
    ],
  },
  {
    heading: "Cookies",
    paragraphs: [
      "No advertising cookies. Firebase uses browser storage to keep you signed in, and the editor uses session storage to carry a draft between views. That is the whole list.",
    ],
  },
  {
    heading: "Sharing",
    paragraphs: [
      "Only with the services named above, and only as far as running LoveBuilds requires — or where the law requires it.",
    ],
  },
  {
    heading: "Keeping and deleting",
    paragraphs: [
      "Your account and its content are kept for as long as the account exists. Want everything gone? Ask, and the account and everything saved to it will be deleted.",
    ],
  },
  {
    heading: "Children",
    paragraphs: [
      "LoveBuilds is not directed at children under 13, and we do not knowingly collect their information.",
    ],
  },
  {
    heading: "Changes",
    paragraphs: [
      "This is a draft, so expect edits before launch. When it changes for real, the date at the bottom moves with it.",
    ],
  },
  {
    heading: "Contact",
    paragraphs: [
      "Questions, or a request to delete everything: hello@lovebuilds.example — a placeholder address while this policy is a draft.",
    ],
  },
];

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
