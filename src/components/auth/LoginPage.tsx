import { type FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { signIn, useSession } from "../../hooks/useSession";
import { isSupabaseConfigured } from "../../lib/supabase";
import "../../login.css";

/**
 * Sign in.
 *
 * There is no "forgot password" and no "create an account" here on purpose.
 * The account is created in the Supabase dashboard and the password is handed
 * over out of band. A self-service reset would put a working recovery path in
 * the app, which is more surface than one person's birthday site needs — and if
 * he forgets the password, resetting it for him takes thirty seconds and is not
 * a problem.
 */
export default function LoginPage() {
  const session = useSession();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  if (!isSupabaseConfigured) return <Navigate to="/dashboard" replace />;
  if (session.status === "signed-in") return <Navigate to={from} replace />;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await signIn(email.trim(), password);
    if (!result.ok) setError(result.message);

    setBusy(false);
    // On success the session listener above navigates. No manual redirect:
    // redirecting here would race it and could land on the login page again.
  };

  return (
    <main className="login">
      <form className="login-card" onSubmit={onSubmit}>
        <h1 className="login-title">LoveBuilds</h1>
        <p className="login-note">Sign in to edit your site.</p>

        {session.status === "checking" ? (
          <p className="login-status">Checking…</p>
        ) : (
          <>
            <label className="login-field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="login-field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button className="login-submit" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </>
        )}
      </form>
    </main>
  );
}