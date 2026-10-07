import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useSession } from "../../hooks/useSession";
import { isSupabaseConfigured } from "../../lib/supabase";

/**
 * Gate for the dashboard.
 *
 * While the session is still being checked this renders nothing, rather than
 * redirecting. Redirecting immediately would bounce a signed-in user to the
 * login page on every refresh, because `getSession` is asynchronous and the
 * first render always looks signed-out.
 */

export default function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();

  if (session.status === "checking") {
    return null;
  }

  if (session.status === "signed-out") {
    // No project configured means auth is not in play yet — Step 4a mode, where
    // the dashboard works for whoever is running it. Refusing entry here would
    // lock you out of your own app.
    if (!isSupabaseConfigured) return <>{children}</>;

    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}