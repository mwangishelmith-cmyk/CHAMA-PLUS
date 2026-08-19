import axios from "axios";
import { tokenStorage } from "./tokenStorage";

/**
 * Base URL comes from the environment. When it is missing we fall back to the
 * bundled mock backend so the whole auth flow is testable without a server.
 */
const API_URL = import.meta.env.VITE_API_URL || "/api";
const TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT) || 15000;

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: TIMEOUT,
  headers: { 
    "Content-Type": "application/json" ,
  },
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
},
  (error) => Promise.reject(error)
);

/* ------------------------------------------------------------------ */
/* Response interceptor: transparent refresh on 401                    */
/* ------------------------------------------------------------------ */

// Callbacks waiting for an in-flight refresh, so concurrent 401s trigger
// exactly one refresh request.
let isRefreshing = false;
let refreshSubscribers = [];
const sessionExpiredHandlers = new Set();

export function onSessionExpired(handler) {
  sessionExpiredHandlers.add(handler);
  return () => sessionExpiredHandlers.delete(handler);
}

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onTokenRefreshed(accessToken) {
  refreshSubscribers.forEach(cb => cb(accessToken));
  refreshSubscribers = [];
}

async function refreshTokens() {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token");

  const { data } = await apiClient.post(
    "/auth/refresh",
    { refreshToken },
    { skipAuth: true, skipRefresh: true },
  );
  tokenStorage.setTokens(data);
  return data.accessToken;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

      if (error.response?.status === 401 && !originalRequest._retry){
      originalRequest._retry = true;
      
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((accessToken) => {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            resolve(apiClient(originalRequest));
          });
        });
      }
      
      isRefreshing = true;
      
      try {
        const refreshToken = tokenStorage.getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }
        
        const response = await axios.post(
          `${API_URL}/auth/refresh`,
          { refreshToken },
          { skipAuth: true, skipRefresh: true }
        );
        
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        tokenStorage.setTokens({ accessToken, refreshToken: newRefreshToken });
        
        isRefreshing = false;
        onTokenRefreshed(accessToken);
        
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        tokenStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    // Normalise the error message so UI code can always read `error.message`.
    error.message = error.response?.data?.message || error.response?.data?.error || error.message || 'An unexpected error occurred';
    return Promise.reject(error);
  },
);

/** Extract a user-facing message from any thrown API error. */
export const getErrorMessage = (error) => {
  return error.response?.data?.message || 
         error.message || 
         'Something went wrong. Please try again.';
};

export default apiClient;
