import { type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useSession } from "../../hooks/useSession";

/**
 * Gate for the dashboard.
 *
 * While the session is still being checked this renders nothing, rather than
 * redirecting. Redirecting immediately would bounce a signed-in user to the login
 * page on every refresh, because the check is asynchronous and the first render
 * always looks signed-out.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();

  if (session.status === "checking") {
    return null;
  }

  if (session.status === "signed-out") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}