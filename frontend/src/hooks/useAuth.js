import { useContext } from "react";

import { AuthContext } from "../context/AuthContext";

/** Access the auth state/actions. Must be used inside <AuthProvider />. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export default useAuth;
