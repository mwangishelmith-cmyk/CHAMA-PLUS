import apiClient from "./client";

/**
 * Tenant (chama) API — routes/tenant.py + backend/routes/directory.py.
 * Every call is authenticated; the backend re-checks membership/role.
 */
export const chamaApi = {
  /** GET /chamas -> [{ chama_id, name, role, debt_balance }] (my memberships) */
  myChamas: async () => (await apiClient.get("/chamas")).data,

  /** GET /chamas/{id} -> { chama_details, members_count, total_balance } */
  detail: async (chamaId) => (await apiClient.get(`/chamas/${chamaId}`)).data,

  /** PUT /chamas/{id} — Chairperson/Treasurer only. */
  update: async (chamaId, body) => (await apiClient.put(`/chamas/${chamaId}`, body)).data,

  /** POST /chamas — submits a chama CREATION REQUEST (super-admin approves). */
  requestCreation: async ({ name, description, chama_type, creator_role, default_contribution_amount }) =>
    (
      await apiClient.post("/chamas", {
        name,
        description: description || null,
        chama_type,
        creator_role,
        default_contribution_amount: default_contribution_amount || null,
      })
    ).data,

  /** GET /chama-requests -> [ChamaCreationRequest] — super admin only. */
  creationRequests: async () => (await apiClient.get("/chama-requests")).data,

  /** PUT /chama-requests/{id}/approve */
  approveCreationRequest: async (requestId) =>
    (await apiClient.put(`/chama-requests/${requestId}/approve`)).data,

  /** PUT /chama-requests/{id}/reject */
  rejectCreationRequest: async (requestId) =>
    (await apiClient.put(`/chama-requests/${requestId}/reject`)).data,

  /** POST /chamas/{id}/join */
  requestJoin: async (chamaId) => (await apiClient.post(`/chamas/${chamaId}/join`)).data,

  /** GET /join-requests -> my join requests (any status). */
  myJoinRequests: async () => (await apiClient.get("/join-requests")).data,

  /** GET /chamas/{id}/join-requests -> pending requests (Chairperson/Treasurer). */
  pendingJoinRequests: async (chamaId) =>
    (await apiClient.get(`/chamas/${chamaId}/join-requests`)).data,

  approveJoinRequest: async (chamaId, requestId) =>
    (await apiClient.put(`/chamas/${chamaId}/join-requests/${requestId}/approve`)).data,

  rejectJoinRequest: async (chamaId, requestId, remarks) =>
    (
      await apiClient.put(`/chamas/${chamaId}/join-requests/${requestId}/reject`, {
        remarks: remarks || null,
      })
    ).data,

  /** GET /chamas/{id}/members -> [{ member_id, full_name, phone_number, joined_date, role }] */
  members: async (chamaId) => (await apiClient.get(`/chamas/${chamaId}/members`)).data,

  /** GET /chamas/directory -> chamas a non-member can request to join. */
  directory: async () => (await apiClient.get("/chamas/directory")).data,

  /** GET/PUT /chamas/{id}/settings — contribution + fine configuration. */
  settings: async (chamaId) => (await apiClient.get(`/chamas/${chamaId}/settings`)).data,
  updateSettings: async (chamaId, body) =>
    (await apiClient.put(`/chamas/${chamaId}/settings`, body)).data,

  addMember: async (chamaId, { email, role }) =>
  (
    await apiClient.post(`/chamas/${chamaId}/members`, {
      email,
      role,
    })
  ).data,

  updateMember: async (chamaId, memberId, body) =>
    (
      await apiClient.put(
        `/chamas/${chamaId}/members/${memberId}`,
        body,
      )
    ).data,

  removeMember: async (chamaId, memberId) =>
    (
      await apiClient.delete(
        `/chamas/${chamaId}/members/${memberId}`,
      )
    ).data,


  adminAuditTrails: async () =>
    (await apiClient.get("/admin/audit-trails")).data,
};

export default chamaApi;
