import { type FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useSession } from "../../hooks/useSession";
import { MIN_PASSCODE_LENGTH, checkPasscode, isPasscodeSet, setPasscode } from "../../lib/site/auth";
import "../../login.css";

/**
 * Unlock the editor.
 *
 * A local passcode, not an account. There is no server to hold credentials, no
 * email to confirm and no password to reset — see `lib/site/auth.ts` for why that
 * is a gate rather than a lock, and what has to replace it.
 *
 * **Two jobs in one form**, because they are the same question asked at different
 * moments: has a passcode been set for this browser yet? If not, the honest thing
 * is to ask them to choose one, rather than to gate them behind a secret nobody
 * chose. `isPasscodeSet` decides which, and it is read at submit time as well as
 * at render, because the two can disagree if another tab set one in between.
 *
 * There is deliberately no "forgot it" link. With a passcode held only in this
 * browser, there is nothing to send a reset to and nothing to recover from —
 * showing a link that cannot work is worse than omitting it. The dashboard bar
 * carries "Sign out" and, once a passcode exists, changing it is an explicit action
 * rather than a recovery flow.
 */
export default function LoginPage() {
  const session = useSession();
  const location = useLocation();
  const [passcode, setPasscodeValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  // Nothing to unlock, or already unlocked. Not a redirect race: this renders
  // before the form can be submitted, so there is nothing to race with.
  if (session.status === "signed-in") return <Navigate to={from} replace />;

  // Read here rather than captured once, so the copy matches what the form will
  // actually do a second later.
  const firstRun = !isPasscodeSet();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = firstRun
      ? await setPasscode(passcode)
      : await checkPasscode(passcode);

    if (!result.ok) setError(result.message);

    setBusy(false);
    // On success the listener above navigates. No manual redirect: it would race
    // the subscription and could land back on this page.
  };

  return (
    <main className="login">
      <form className="login-card" onSubmit={onSubmit}>
        <h1 className="login-title">LoveBuilds</h1>

        {session.status === "checking" ? (
          <p className="login-status">Checking…</p>
        ) : (
          <>
            <p className="login-note">
              {firstRun
                ? "Choose a passcode to protect the editor."
                : "Enter your passcode to edit your site."}
            </p>

            <label className="login-field">
              <span>Passcode</span>
              <input
                type="password"
                autoComplete={firstRun ? "new-password" : "current-password"}
                value={passcode}
                onChange={(e) => setPasscodeValue(e.target.value)}
                autoFocus
                required
              />
            </label>

            <p className="login-hint">
              At least {MIN_PASSCODE_LENGTH} characters.
            </p>

            {firstRun && (
              <p className="login-note">
                This keeps the editor out of reach on this computer. It is not a
                password and it does not encrypt anything — the sites themselves are
                already in this browser.
              </p>
            )}

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button className="login-submit" type="submit" disabled={busy}>
              {busy ? "Checking…" : firstRun ? "Set passcode" : "Unlock"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}