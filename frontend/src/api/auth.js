import apiClient from "./client";

/**
 * Auth + session API.
 *
 * Backend contract (routes/auth.py):
 *   POST /auth/register -> { user_id, message, token }
 *   POST /auth/login    -> { token, user_id, full_name, memberships }
 *   POST /auth/logout   -> { message }
 *   GET  /users/me      -> { user_profile, memberships }
 *
 * `memberships` from auth.py only carries `{ chama_id, role }`. The member
 * dashboard/ledger need `member_id`, so we prefer the richer
 * `GET /me/context` endpoint (see backend/routes/context.py) and fall back to
 * `/users/me` when it is not deployed.
 */
export const authApi = {
  register: async ({ full_name, email, password, phone_number }) => {
    const { data } = await apiClient.post(
      "/auth/register",
      { full_name, email, password, phone_number: phone_number || null },
      { skipAuth: true, skipRefresh: true },
    );
    return data;
  },

  login: async ({ email, password }) => {
    const { data } = await apiClient.post(
      "/auth/login",
      { email, password },
      { skipAuth: true, skipRefresh: true },
    );
    return data;
  },

  
  /** Raw profile call — always available. */
  me: async () => {
    const { data } = await apiClient.get("/users/me");
    return data;
  },

  /**
   * Full session context: profile, memberships (with member_id + chama name)
   * and any pending join / chama-creation requests.
   */
  context: async () => {
    try {
      const { data } = await apiClient.get("/users/me");
      return normaliseContext(data);
    } catch (error) {
      if (error?.response?.status !== 404) throw error;
      // Fallback: no /me/context on this backend build.
      const data = await authApi.me();
      return normaliseContext({
        user_profile: data.user_profile,
        memberships: data.memberships,
        pending_join_requests: [],
        pending_chama_requests: [],
        context_endpoint_missing: true,
      });
    }
  },

  logout: async () => {
    try {
      await apiClient.post("/auth/logout", {}, { skipRefresh: true });
    } catch {
      /* stateless JWT — clearing the client token is enough */
    }
  },
};

/** Map the backend payload onto a stable shape the UI consumes. */
export function normaliseContext(payload) {
  const profile = payload.user_profile || {};
  return {
    user: {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      phone_number: profile.phone_number ?? null,
      is_super_admin: Boolean(profile.is_super_admin),
      email_verified: Boolean(profile.email_verified),
    },
    memberships: (payload.memberships || []).map((m) => ({
      member_id: m.member_id ?? null,
      chama_id: m.chama_id,
      chama_name: m.chama_name ?? null,
      chama_created_at: m.chama_created_at ?? null,
      role: m.role,
      joined_date: m.joined_date ?? null,
    })),
    pendingJoinRequests: payload.pending_join_requests || [],
    pendingChamaRequests: payload.pending_chama_requests || [],
    contextEndpointMissing: Boolean(payload.context_endpoint_missing),
  };
}

export default authApi;
