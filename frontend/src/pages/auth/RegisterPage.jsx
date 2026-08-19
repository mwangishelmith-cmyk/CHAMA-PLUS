import PropTypes from "prop-types";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import AuthLayout from "../../components/auth/AuthLayout";
import Register from "../../components/auth/Register";
import useAuth from "../../hooks/useAuth";

/** /register — creates an account and signs the user straight in. */
export function RegisterPage({ redirectTo = "/dashboard" }) {
  const { isAuthenticated, initializing } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!initializing && isAuthenticated) {
      navigate({ to: redirectTo || "/dashboard", replace: true });
    }
  }, [initializing, isAuthenticated, navigate, redirectTo]);

  return (
    <AuthLayout title="Create your account" subtitle="Start tracking your chama in minutes.">
      <Register redirectTo={redirectTo} />
    </AuthLayout>
  );
}

RegisterPage.propTypes = { redirectTo: PropTypes.string };

export default RegisterPage;
