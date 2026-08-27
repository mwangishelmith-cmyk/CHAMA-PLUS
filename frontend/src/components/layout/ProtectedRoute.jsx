import PropTypes from "prop-types";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import useAuth from "../../hooks/useAuth";
import { useChama } from "../../context/ChamaContext";
import LoadingSpinner from "../common/LoadingSpinner";
import { roleIn } from "../../lib/roles";

/**
 * Route guard. Four ordered checks, all driven by server-issued state:
 *
 *  1. Authentication — anonymous visitors go to /login?redirect=…
 *  2. Platform admins (`is_super_admin`) are kept out of member-only pages.
 *  3. Membership — users without a member profile are sent back to
 *     /dashboard, which renders the onboarding / pending state.
 *  4. Role — `roles` is checked against the CURRENT chama membership role.
 *
 * The backend re-authorises every request, so this guard is UX only; it just
 * makes URL-typing behave the same way the API does.
 */
/** @param {{ children: import("react").ReactNode, roles?: string[], requireMembership?: boolean, allowSuperAdmin?: boolean, superAdminOnly?: boolean }} props */
export function ProtectedRoute({
  children,
  roles,
  requireMembership = false,
  allowSuperAdmin = false,
  superAdminOnly = false,
}) {
  const { isAuthenticated, initializing, isSuperAdmin } = useAuth();
  const { membership, memberships, role } = useChama();
  const navigate = useNavigate();
  const href = useRouterState({ select: (s) => s.location.href });
  const intendedHref = useRef(href);
  const redirected = useRef(false);

  const superAdminBlocked = isSuperAdmin && !allowSuperAdmin && !superAdminOnly;
  const notAdminButAdminOnly = superAdminOnly && !isSuperAdmin;
  const membershipMissing = requireMembership && !isSuperAdmin && memberships.length === 0;
  const roleBlocked =
    roles && !isSuperAdmin && Boolean(membership) && !roleIn(role, roles);

  useEffect(() => {
    if (initializing || redirected.current) return;

    if (!isAuthenticated) {
      redirected.current = true;
      const target = intendedHref.current;
      navigate({
        to: "/login",
        search: target && !target.startsWith("/login") ? { redirect: target } : {},
        replace: true,
      });
      return;
    }

    if (membershipMissing) {
      redirected.current = true;
      navigate({ to: "/dashboard", replace: true });
      return;
    }

    if (superAdminBlocked || notAdminButAdminOnly || roleBlocked) {
      redirected.current = true;
      navigate({ to: "/unauthorized", replace: true });
    }
  }, [
    initializing,
    isAuthenticated,
    membershipMissing,
    superAdminBlocked,
    notAdminButAdminOnly,
    roleBlocked,
    navigate,
  ]);

  const blocked =
    initializing ||
    !isAuthenticated ||
    membershipMissing ||
    superAdminBlocked ||
    notAdminButAdminOnly ||
    roleBlocked;

  if (blocked) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-primary">
        <LoadingSpinner size="lg" label="Checking your access" />
      </div>
    );
  }

  return children;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node,
  /** Chama roles allowed on this page (checked against the selected chama). */
  roles: PropTypes.arrayOf(PropTypes.string),
  /** Page needs an approved chama membership. */
  requireMembership: PropTypes.bool,
  /** Platform administrators may open this page too. */
  allowSuperAdmin: PropTypes.bool,
  /** Page is for platform administrators only. */
  superAdminOnly: PropTypes.bool,
};

export default ProtectedRoute;
