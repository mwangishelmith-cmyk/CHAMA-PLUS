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
    if (!initializing && isAuthenticated) {
      navigate({ to: redirectTo || "/dashboard", replace: true });
    }
  }, [initializing, isAuthenticated, navigate, redirectTo]);

  return (
    <AuthLayout title="Sign in" subtitle="Welcome back. Enter your details to continue.">
      <Login redirectTo={redirectTo} />
      {/* {usingMockApi && (
        <p className="mt-5 rounded-lg bg-muted px-3 py-2 text-center text-xs text-muted-foreground">
          Demo mode: no API configured, so accounts are stored locally. Register once, then sign
          in with the same details.
        </p>
      )} */}
    </AuthLayout>
  );
}

LoginPage.propTypes = { redirectTo: PropTypes.string };

export default LoginPage;
