import PropTypes from "prop-types";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import useAuth from "../../hooks/useAuth";
import LoadingSpinner from "../common/LoadingSpinner";

/**
 * Guards a page: while the session is being restored we render a spinner, and
 * unauthenticated visitors are redirected to /login with `?redirect=<path>` so
 * they land back where they intended after signing in.
 */
export function ProtectedRoute({ children }) {
  const { isAuthenticated, initializing } = useAuth();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  // Capture the originally requested URL once, and make sure we only ever fire
  // a single redirect (otherwise the effect could re-run and nest ?redirect=).
  const intendedHref = useRef(href);
  const redirected = useRef(false);

  useEffect(() => {
    if (initializing || isAuthenticated || redirected.current) return;
    redirected.current = true;
    const target = intendedHref.current;
    navigate({
      to: "/login",
      search: target && !target.startsWith("/login") ? { redirect: target } : {},
      replace: true,
    });
  }, [initializing, isAuthenticated, navigate]);

  if (initializing || !isAuthenticated) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-primary">
        <LoadingSpinner size="lg" label="Checking your session" />
      </div>
    );
  }

  return children;
}

ProtectedRoute.propTypes = { children: PropTypes.node };

export default ProtectedRoute;
