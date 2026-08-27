import PropTypes from "prop-types";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import AuthLayout from "../../components/auth/AuthLayout";
import Login from "../../components/auth/Login";
import useAuth from "../../hooks/useAuth";

/** /login — signs the user in and bounces already-authenticated visitors away. */
export function LoginPage({ redirectTo = "/dashboard" }) {
  const { isAuthenticated, initializing } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const safeRedirect =
      redirectTo &&
      redirectTo !== "/unauthorized" &&
      redirectTo.startsWith("/")
        ? redirectTo
        : "/dashboard";

    if (!initializing && isAuthenticated) {
      navigate({ to: safeRedirect, replace: true });
    }
  }, [initializing, isAuthenticated, navigate, redirectTo]);

  return (
    <AuthLayout title="Sign in" subtitle="Welcome back. Enter your details to continue.">
      <Login redirectTo={redirectTo} />
    </AuthLayout>
  );
}

LoginPage.propTypes = { redirectTo: PropTypes.string };

export default LoginPage;
