import apiClient from './client';

export const ledgerApi = {
  // Add contribution - POST /api/v1/chamas/{chama_id}/ledger/contribution
  addContribution: async (chamaId, data) => {
    const response = await apiClient.post(`/chamas/${chamaId}/ledger/contribution`, data);
    // Returns: { ledger_entry_id, previous_balance, new_balance }
    return response.data;
  },
  
  // Add payment - POST /api/v1/chamas/{chama_id}/ledger/payment
  addPayment: async (chamaId, data) => {
    const response = await apiClient.post(`/chamas/${chamaId}/ledger/payment`, data);
    // Returns: { ledger_entry_id, previous_balance, new_balance }
    return response.data;
  },
  
  // Apply fine - POST /api/v1/chamas/{chama_id}/ledger/fine
  applyFine: async (chamaId, data) => {
    const response = await apiClient.post(`/chamas/${chamaId}/ledger/fine`, data);
    // Returns: { ledger_entry_id, previous_balance, new_balance }
    return response.data;
  },
  
  // Add adjustment - POST /api/v1/chamas/{chama_id}/ledger/adjustment
  addAdjustment: async (chamaId, data) => {
    const response = await apiClient.post(`/chamas/${chamaId}/ledger/adjustment`, data);
    // Returns: { ledger_entry_id, previous_balance, new_balance }
    return response.data;
  },
  
  // Get member statement - GET /api/v1/chamas/{chama_id}/ledger/member/{member_id}
  getMemberStatement: async (chamaId, memberId) => {
    const response = await apiClient.get(`/chamas/${chamaId}/ledger/member/${memberId}`);
    // Returns: { member_id, statement, outstanding_debt, payments, fines }
    return response.data;
  },
  
  // Get chama balance - GET /api/v1/chamas/{chama_id}/ledger/balance
  getChamaBalance: async (chamaId) => {
    const response = await apiClient.get(`/chamas/${chamaId}/ledger/balance`);
    // Returns: { total_balance, total_contributions, total_fines, total_debt }
    return response.data;
  },
  
  // Get all members ledger summary - GET /api/v1/chamas/{chama_id}/ledger/all-members
  getAllMembersLedgerSummary: async (chamaId) => {
    const response = await apiClient.get(`/chamas/${chamaId}/ledger/all-members`);
    // Returns array of { member_name, debt_balance, last_payment, status }
    return response.data;
  },
  
  // Reconcile account - POST /api/v1/chamas/{chama_id}/accounts/{account_id}/reconcile
  reconcileAccount: async (chamaId, accountId, data) => {
    const response = await apiClient.post(`/chamas/${chamaId}/accounts/${accountId}/reconcile`, data);
    // Returns: { account_id, reconciliation_status, last_reconciled_date }
    return response.data;
  },
  
  // Add chama account - POST /api/v1/chamas/{chama_id}/accounts
  addAccount: async (chamaId, data) => {
    const response = await apiClient.post(`/chamas/${chamaId}/accounts`, data);
    // Returns: account details
    return response.data;
  }
};

export default ledgerApi;