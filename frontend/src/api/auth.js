import apiClient from "./client";
import { tokenStorage } from '../api/tokenStorage';

/** Auth API surface. All calls return plain data (no axios envelope). */
export const authApi = {
  /** POST /auth/register -> { user, accessToken, refreshToken } */
  register: async ({ email, password, full_name, phone_number }) => {
    const response = await apiClient.post('/auth/register', {
      email,
      password,
      full_name,
      phone_number
    }, { skipAuth: true, skipRefresh: true });
    
  // Backend returns: { user_id, message, token }
  return response.data;
  },

  /** POST /auth/login -> { user, accessToken, refreshToken } */
  login: async ({ email, password }) => {
    const response = await apiClient.post('/auth/login', {
      email,
      password
    }, { skipAuth: true, skipRefresh: true });
  
  // Backend returns: { token, user_id, full_name, memberships }
  return response.data;
  },

  /** GET /auth/me -> user (used to re-validate a persisted session) */

  // add endpoint /auth/me for token validation and user retrieval
  // me: async () => {
  //   const { data } = await apiClient.get("/auth/me");
  //   return data.user;
  // },

  /** POST /auth/logout — best effort; local tokens are cleared regardless. */
  logout: async () => {
    try {
      await apiClient.post('/auth/logout', {}, { skipRefresh: true });
    } catch (error) {
      console.warn('Logout API error:', error);
    }
      tokenStorage.clear();
  },
  
  getProfile: async () => {
    const response = await apiClient.get('/users/me');
    // Backend returns: { user_profile, memberships }
    return response.data;
  },

  updateProfile: async (data) => {
    const response = await apiClient.put('/users/me', data);
    // Backend returns: { updated_profile }
    return response.data;
  }
};

export default authApi;
