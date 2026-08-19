import apiClient from './client';

export const chamaApi = {
  // List user's chamas - GET /api/v1/chamas
  listChamas: async () => {
    const response = await apiClient.get('/chamas');
    return response.data; // Returns array of chama objects
  },
  
  // Get chama details - GET /api/v1/chamas/{chama_id}
  getChama: async (chamaId) => {
    const response = await apiClient.get(`/chamas/${chamaId}`);
    // Returns: { chama_details, members_count, total_balance }
    return response.data;
  },
  
  // Update chama - PUT /api/v1/chamas/{chama_id}
  updateChama: async (chamaId, data) => {
    const response = await apiClient.put(`/chamas/${chamaId}`, data);
    // Returns: { updated_chama_details }
    return response.data;
  },
  
  // Create chama request - POST /api/v1/chamas
  createChamaRequest: async (data) => {
    const response = await apiClient.post('/chamas', data);
    // Returns: { request_id, status, message }
    return response.data;
  },
  
  // List chama members - GET /api/v1/chamas/{chama_id}/members
  getMembers: async (chamaId) => {
    const response = await apiClient.get(`/chamas/${chamaId}/members`);
    return response.data;
  },
  
  // Add member - POST /api/v1/chamas/{chama_id}/members
  addMember: async (chamaId, memberData) => {
    const response = await apiClient.post(`/chamas/${chamaId}/members`, memberData);
    // Returns: { member_id, user_id, role, joined_date }
    return response.data;
  },
  
  // Update member - PUT /api/v1/chamas/{chama_id}/members/{member_id}
  updateMember: async (chamaId, memberId, data) => {
    const response = await apiClient.put(`/chamas/${chamaId}/members/${memberId}`, data);
    // Returns: { updated_member_details }
    return response.data;
  },
  
  // Remove member - DELETE /api/v1/chamas/{chama_id}/members/{member_id}
  removeMember: async (chamaId, memberId) => {
    const response = await apiClient.delete(`/chamas/${chamaId}/members/${memberId}`);
    return response.data;
  },
  
  // Submit join request - POST /api/v1/chamas/{chama_id}/join
  submitJoinRequest: async (chamaId) => {
    const response = await apiClient.post(`/chamas/${chamaId}/join`);
    // Returns: { message, request_id, status }
    return response.data;
  },
  
  // List user's join requests - GET /api/v1/join-requests
  listMyJoinRequests: async () => {
    const response = await apiClient.get('/join-requests');
    return response.data;
  },
  
  // List pending join requests - GET /api/v1/chamas/{chama_id}/join-requests
  listPendingJoinRequests: async (chamaId) => {
    const response = await apiClient.get(`/chamas/${chamaId}/join-requests`);
    return response.data;
  },
  
  // Approve join request - PUT /api/v1/chamas/{chama_id}/join-requests/{request_id}/approve
  approveJoinRequest: async (chamaId, requestId) => {
    const response = await apiClient.put(`/chamas/${chamaId}/join-requests/${requestId}/approve`);
    // Returns: { message, member_id }
    return response.data;
  },
  
  // Reject join request - PUT /api/v1/chamas/{chama_id}/join-requests/{request_id}/reject
  rejectJoinRequest: async (chamaId, requestId, data) => {
    const response = await apiClient.put(`/chamas/${chamaId}/join-requests/${requestId}/reject`, data);
    return response.data;
  }
};

export default chamaApi;