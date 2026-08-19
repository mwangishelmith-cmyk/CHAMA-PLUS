/**
 * Single source of truth for JWT persistence.
 * localStorage is used so the session survives a full page reload.
 * (Swap for httpOnly cookies once a real backend can set them.)
 */
const ACCESS_KEY = "auth.accessToken";
const REFRESH_KEY = "auth.refreshToken";
const USER_KEY = "auth.user";

const isBrowser = typeof window !== "undefined";

export const tokenStorage = {
  getAccessToken: () => (isBrowser ? window.localStorage.getItem(ACCESS_KEY) : null),
  getRefreshToken: () => (isBrowser ? window.localStorage.getItem(REFRESH_KEY) : null),

  getUser() {
    if (!isBrowser) return null;
    try {
      return JSON.parse(window.localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  },

  setTokens({ accessToken, refreshToken }) {
    if (!isBrowser) return;
    if (accessToken) window.localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) window.localStorage.setItem(REFRESH_KEY, refreshToken);
  },

  setUser(user) {
    if (!isBrowser) return;
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clear() {
    if (!isBrowser) return;
    [ACCESS_KEY, REFRESH_KEY, USER_KEY].forEach((k) => window.localStorage.removeItem(k));
  },

  isAuthenticated() {
    if (!isBrowser) return false;
    return !!window.localStorage.getItem(ACCESS_KEY);
  },
};
