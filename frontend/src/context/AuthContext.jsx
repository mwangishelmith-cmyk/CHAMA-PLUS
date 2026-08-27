import PropTypes from "prop-types";
import { createContext, useCallback, useEffect, useMemo, useState } from "react";

import authApi from "../api/auth";
import { getErrorMessage, onSessionExpired } from "../api/client";
import { tokenStorage } from "../api/tokenStorage";

export const AuthContext = createContext(null);

const EMPTY_CONTEXT = {
  user: null,
  memberships: [],
  pendingJoinRequests: [],
  pendingChamaRequests: [],
  contextEndpointMissing: false,
};

/**
 * Owns the authenticated session.
 *
 * The backend is the single source of truth: after login/register we always
 * re-read the session context (`GET /me/context`, falling back to
 * `GET /users/me`) so `is_super_admin`, memberships and pending requests come
 * from the server, never from client input.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(EMPTY_CONTEXT);
  const [initializing, setInitializing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const loadContext = useCallback(async () => {
    const ctx = await authApi.context();
    tokenStorage.setUser(ctx.user);
    setSession(ctx);
    return ctx;
  }, []);

  // Bootstrap from the persisted token.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!tokenStorage.getAccessToken()) {
        if (!cancelled) setInitializing(false);
        return;
      }
      // Optimistically restore the cached profile so there is no auth flash.
      const cached = tokenStorage.getUser();
      if (cached && !cancelled) setSession((s) => ({ ...s, user: cached }));
      try {
        const ctx = await authApi.context();
        if (!cancelled) {
          tokenStorage.setUser(ctx.user);
          setSession(ctx);
        }
      } catch {
        if (!cancelled) {
          tokenStorage.clear();
          setSession(EMPTY_CONTEXT);
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // The axios interceptor tells us when the token was rejected.
  useEffect(() => onSessionExpired(() => setSession(EMPTY_CONTEXT)), []);

  const run = useCallback(
    async (fn) => {
      setSubmitting(true);
      setError(null);
      try {
        return await fn();
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        throw new Error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  const login = useCallback(
    (credentials) =>
      run(async () => {
        const data = await authApi.login(credentials);
        tokenStorage.setTokens({ accessToken: data.token });
        return loadContext();
      }),
    [run, loadContext],
  );

  const register = useCallback(
    (payload) =>
      run(async () => {
        const data = await authApi.register(payload);
        tokenStorage.setTokens({ accessToken: data.token });
        return loadContext();
      }),
    [run, loadContext],
  );

  const refresh = useCallback(async () => {
    try {
      return await loadContext();
    } catch {
      return null;
    }
  }, [loadContext]);

  const logout = useCallback(async () => {
    await authApi.logout();
    tokenStorage.clear();
    setSession(EMPTY_CONTEXT);
  }, []);

  const { user, memberships, pendingJoinRequests, pendingChamaRequests } = session;

  const value = useMemo(
    () => ({
      user,
      memberships,
      pendingJoinRequests,
      pendingChamaRequests,
      contextEndpointMissing: session.contextEndpointMissing,
      isAuthenticated: Boolean(user),
      isSuperAdmin: Boolean(user?.is_super_admin),
      hasMembership: memberships.length > 0,
      hasPendingRequest: pendingJoinRequests.length > 0 || pendingChamaRequests.length > 0,
      initializing,
      submitting,
      error,
      clearError: () => setError(null),
      login,
      register,
      logout,
      refresh,
    }),
    [
      user,
      memberships,
      pendingJoinRequests,
      pendingChamaRequests,
      session.contextEndpointMissing,
      initializing,
      submitting,
      error,
      login,
      register,
      logout,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = { children: PropTypes.node };
