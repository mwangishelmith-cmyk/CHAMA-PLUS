import axios from "axios";

import { tokenStorage } from "./tokenStorage";

/**
 * Axios instance for the ChamaPlus Flask API.
 *
 * Base URL: `VITE_API_URL` when provided, otherwise the local Flask default
 * (`http://localhost:5000/api/v1`). Every blueprint is registered under
 * `/api/v1`, so paths below are written relative to it (e.g. `/auth/login`).
 */
const baseURL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api/v1";

export const apiBaseUrl = baseURL;

const apiClient = axios.create({
  baseURL,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

/* ------------------------------------------------------------------ */
/* Request interceptor: attach the access token                        */
/* ------------------------------------------------------------------ */
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token && !config.skipAuth) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/* ------------------------------------------------------------------ */
/* Response interceptor                                                */
/* ------------------------------------------------------------------ */

const sessionExpiredHandlers = new Set();
const forbiddenHandlers = new Set();

/** Fired when the backend rejects the token (401) — the app signs the user out. */
export function onSessionExpired(handler) {
  sessionExpiredHandlers.add(handler);
  return () => sessionExpiredHandlers.delete(handler);
}

/** Fired on 403 so the shell can surface a permission message. */
export function onForbidden(handler) {
  forbiddenHandlers.add(handler);
  return () => forbiddenHandlers.delete(handler);
}

/**
 * Token refresh is intentionally dormant: the current backend issues a single
 * 1-day access token and exposes no `/auth/refresh` endpoint. The plumbing is
 * kept so refresh can be switched on by setting `VITE_API_REFRESH_PATH`
 * once the backend supports it.
 */
const REFRESH_PATH = import.meta.env.VITE_API_REFRESH_PATH || null;
let refreshPromise = null;

async function refreshTokens() {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!REFRESH_PATH || !refreshToken) throw new Error("Refresh not supported");
  const { data } = await apiClient.post(
    REFRESH_PATH,
    { refreshToken },
    { skipAuth: true, skipRefresh: true },
  );
  tokenStorage.setTokens({ accessToken: data.token || data.accessToken });
  return tokenStorage.getAccessToken();
}

function notifySessionExpired() {
  tokenStorage.clear();
  sessionExpiredHandlers.forEach((handler) => handler());
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;

    if (status === 401 && !original._retry && !original.skipRefresh) {
      original._retry = true;
      if (REFRESH_PATH && tokenStorage.getRefreshToken()) {
        try {
          refreshPromise =
            refreshPromise ||
            refreshTokens().finally(() => {
              refreshPromise = null;
            });
          const accessToken = await refreshPromise;
          original.headers = { ...original.headers, Authorization: `Bearer ${accessToken}` };
          return apiClient(original);
        } catch {
          notifySessionExpired();
        }
      } else {
        // No refresh endpoint: the session is simply over.
        notifySessionExpired();
      }
    }

    if (status === 403) {
      forbiddenHandlers.forEach((handler) => handler(error));
    }

    error.message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      (error.code === "ERR_NETWORK"
        ? "Cannot reach the ChamaPlus API. Check that the backend is running."
        : error.message) ||
      "Something went wrong. Please try again.";
    return Promise.reject(error);
  },
);

/** Extract a user-facing message from any thrown API error. */
export const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || "Unexpected error. Please try again.";

/** True when the backend has no handler for this call (feature not deployed yet). */
export const isNotImplemented = (error) => error?.response?.status === 404;

export default apiClient;
