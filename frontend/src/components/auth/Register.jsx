import PropTypes from "prop-types";
import { Link, useNavigate } from "@tanstack/react-router";
import { Lock, Mail, Phone, User } from "lucide-react";
import { useState } from "react";

import Button from "../common/Button";
import Input from "../common/Input";
import useAuth from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Account creation form.
 *
 * Fields mirror `POST /auth/register` exactly: full_name, email, password and
 * an optional phone_number. There is deliberately NO role picker — a chama
 * role lives on the member profile and is assigned by a chama official when a
 * join request is approved (or by the platform admin approving a new chama).
 */
export function Register({ redirectTo = "/dashboard" }) {
  const { register, submitting } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [values, setValues] = useState({
    full_name: "",
    email: "",
    phone_number: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const change = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (values.full_name.trim().length < 2) next.full_name = "Please enter your full name.";
    if (!EMAIL_RE.test(values.email)) next.email = "Enter a valid email address.";
    if (values.password.length < 6) next.password = "Use at least 6 characters.";
    if (values.password !== values.confirmPassword)
      next.confirmPassword = "Passwords do not match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    try {
      const ctx = await register({
        full_name: values.full_name.trim(),
        email: values.email.trim(),
        password: values.password,
        phone_number: values.phone_number.trim() || null,
      });
      toast.success(`Account created. Welcome, ${ctx.user.full_name}.`);
      navigate({ to: redirectTo || "/dashboard", replace: true });
    } catch (err) {
      setFormError(err.message);
      toast.error(err.message);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {formError}
        </div>
      )}

      <Input
        label="Full name"
        name="full_name"
        autoComplete="name"
        placeholder="Grace Wanjiru"
        value={values.full_name}
        onChange={change("full_name")}
        error={errors.full_name}
        leadingIcon={<User className="h-4 w-4" />}
        required
      />

      <Input
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={values.email}
        onChange={change("email")}
        error={errors.email}
        leadingIcon={<Mail className="h-4 w-4" />}
        required
      />

      <Input
        label="Phone number"
        type="tel"
        name="phone_number"
        autoComplete="tel"
        placeholder="+254 7xx xxx xxx"
        value={values.phone_number}
        onChange={change("phone_number")}
        error={errors.phone_number}
        hint="Optional — helps chama officials identify you."
        leadingIcon={<Phone className="h-4 w-4" />}
      />

      <Input
        label="Password"
        type="password"
        name="password"
        autoComplete="new-password"
        placeholder="••••••••"
        value={values.password}
        onChange={change("password")}
        error={errors.password}
        hint="At least 6 characters."
        leadingIcon={<Lock className="h-4 w-4" />}
        required
      />

      <Input
        label="Confirm password"
        type="password"
        name="confirmPassword"
        autoComplete="new-password"
        placeholder="••••••••"
        value={values.confirmPassword}
        onChange={change("confirmPassword")}
        error={errors.confirmPassword}
        leadingIcon={<Lock className="h-4 w-4" />}
        required
      />

      <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        Your chama role is assigned by a chama official after you join or create a chama.
      </p>

      <Button type="submit" fullWidth loading={submitting}>
        {submitting ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

Register.propTypes = { redirectTo: PropTypes.string };

export default Register;
