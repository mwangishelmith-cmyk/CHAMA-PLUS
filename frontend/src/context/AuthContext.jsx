import PropTypes from "prop-types";
import { createContext, useCallback, useEffect, useMemo, useState } from "react";

import authApi from "../api/auth";
import { getErrorMessage, onSessionExpired } from "../api/client";
import { tokenStorage } from "../api/tokenStorage";

export const AuthContext = createContext(null);

/**
 * Holds the authenticated user and exposes login/register/logout.
 *
 * Session persistence: tokens + a cached user live in localStorage. On mount we
 * optimistically restore the cached user (no auth flash) and then re-validate
 * against `GET /auth/me`; a 401 there is transparently refreshed by the axios
 * interceptor, and only an unrecoverable failure signs the user out.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Bootstrap the session from storage.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const cached = tokenStorage.getUser();
      const token = tokenStorage.getAccessToken() || tokenStorage.getRefreshToken();
      if (!token) {
        if (!cancelled) setInitializing(false);
        return;
      }
      if (cached && !cancelled) setUser(cached);
      try {
        const profileData = await authApi.me();
        if (cancelled) return;

        const userData = {
          id: profileData.user_profile.id,
          email: profileData.user_profile.email,
          full_name: profileData.user_profile.full_name,
          name: profileData.user_profile.full_name, // For compatibility with DashboardPage
          phone_number: profileData.user_profile.phone_number,
          memberships: profileData.memberships || [],
          is_super_admin: profileData.user_profile.is_super_admin || false,
          ...profileData.user_profile
        };
        
        tokenStorage.setUser(userData);
        setUser(userData);
      } catch {
        if (!cancelled) {
          tokenStorage.clear();
          setUser(null);
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // The axios interceptor tells us when the refresh flow failed for good.
  useEffect(() => onSessionExpired(() => setUser(null)), []);

  const persistSession = useCallback((data) => {
    const accessToken = data.token || data.accessToken;
    const refreshToken = data.refreshToken || data.token; // Fallback if no separate refresh token
    
    tokenStorage.setTokens({ accessToken, refreshToken });
    
    // Transform user data
    const userData = {
      id: data.user_id || data.user?.id,
      email: data.email || data.user?.email,
      full_name: data.full_name || data.user?.full_name || data.user?.name,
      name: data.full_name || data.user?.full_name || data.user?.name,
      phone_number: data.phone_number || data.user?.phone_number,
      memberships: data.memberships || data.user?.memberships || [],
      is_super_admin: data.is_super_admin || data.user?.is_super_admin || false,
      ...data.user
    };
    
    tokenStorage.setUser(userData);
    setUser(userData);
    return userData;
  }, []);

  const login = useCallback(
    async (credentials) => {
      setSubmitting(true);
      setError(null);
      try {
        const response = await authApi.login(credentials);
        return persistSession(response);
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        throw new Error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [persistSession],
  );

  const register = useCallback(
    async (payload) => {
      setSubmitting(true);
      setError(null);
      try {
        const response = await authApi.register(payload);
        // After registration, automatically log in
        if (response.token) {
          return persistSession(response);
        }
        return response;
      } catch (err) {
        const message = getErrorMessage(err);
        setError(message);
        throw new Error(message);
      } finally {
        setSubmitting(false);
      }
    },
    [persistSession],
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    tokenStorage.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      initializing,
      submitting,
      error,
      clearError: () => setError(null),
      login,
      register,
      logout,
    }),
    [user, initializing, submitting, error, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = { children: PropTypes.node };
