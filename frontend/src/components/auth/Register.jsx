import PropTypes from "prop-types";
import { Link, useNavigate } from "@tanstack/react-router";
import { Lock, Mail, Phone, User } from "lucide-react";
import { useState } from "react";

import Button from "../common/Button";
import Input from "../common/Input";
import useAuth from "../../hooks/useAuth";
import { useToast } from "../../context/ToastContext";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Account creation form. On success the user is signed in immediately. */
export function Register({ redirectTo = "/dashboard" }) {
  const { register, submitting } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [values, setValues] = useState({
    name: "",
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
    if (values.name.trim().length < 2) next.name = "Please enter your full name.";
    if (!EMAIL_RE.test(values.email)) next.email = "Enter a valid email address.";
    if (values.phone_number.trim().length < 10) 
      next.phone_number = "Enter a valid phone number.";
      setErrors(next);
    if (values.password.length < 6) next.password = "Use at least 6 characters.";
    if (values.password !== values.confirmPassword)
      next.confirmPassword = "Passwords do not match.";
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;
    try {
      const user = await register({
        full_name: values.name.trim(),
        email: values.email.trim(),
        phone_number: values.phone_number.trim(),
        password: values.password,
      });
      toast.success(`Account created. Welcome, ${user.full_name}.`);
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
        name="name"
        autoComplete="name"
        placeholder="Grace Wanjiru"
        value={values.name}
        onChange={change("name")}
        error={errors.name}
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
        placeholder="0712345678"
        value={values.phone_number}
        onChange={change("phone_number")}
        error={errors.phone_number}
        leadingIcon={<Phone className="h-4 w-4" />}
        required
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

      <Button type="submit" fullWidth loading={submitting}>
        {submitting ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

Register.propTypes = { redirectTo: PropTypes.string };

export default Register;
