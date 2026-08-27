import apiClient from "./client";

/** Ledger API — routes/ledger.py + backend/routes/reporting.py. */
export const ledgerApi = {
  /**
   * GET /chamas/{chamaId}/ledger/member/{memberId}
   * -> { member_id, statement[], outstanding_debt, payments, fines }
   * Members may only read their own statement (backend enforces it).
   */
  memberStatement: async (chamaId, memberId) => {
  const { data } = await apiClient.get(
    `/chamas/${chamaId}/ledger/member/${memberId}`,
  );

  return {
    ...data,
    statement: (data.statement || []).map((entry) => ({
      ...entry,
      date: entry.transaction_date,
      type: entry.transaction_type,
      description: entry.transaction_subtype || entry.transaction_type,
    })),
  };
  },
  /** GET /chamas/{chamaId}/ledger/balance — Chairperson/Treasurer only. */
  chamaBalance: async (chamaId) => (await apiClient.get(`/chamas/${chamaId}/ledger/balance`)).data,

  /** GET /chamas/{chamaId}/ledger/all-members — Chairperson/Treasurer only. */
  allMembers: async (chamaId) =>
    (await apiClient.get(`/chamas/${chamaId}/ledger/all-members`)).data,

  /** POST /chamas/{chamaId}/ledger/payment — Treasurer only. */
  recordPayment: async (chamaId, { member_id, amount, reference, payment_method }) =>
    (
      await apiClient.post(`/chamas/${chamaId}/ledger/payment`, {
        member_id,
        amount,
        reference: reference || null,
        payment_method: payment_method || null,
      })
    ).data,

  /** POST /chamas/{chamaId}/ledger/contribution — Treasurer only. */
  recordContribution: async (chamaId, body) =>
    (await apiClient.post(`/chamas/${chamaId}/ledger/contribution`, body)).data,

  /** GET /chamas/{chamaId}/ledger/entries — treasurer view of every member entry. */
  chamaEntries: async (chamaId) => (await apiClient.get(`/chamas/${chamaId}/ledger/entries`)).data,

    // frontend/src/api/ledger.js

  recordFine: async (chamaId, body) =>
    (await apiClient.post(`/chamas/${chamaId}/ledger/fine`, body)).data,

  recordAdjustment: async (chamaId, body) =>
    (await apiClient.post(`/chamas/${chamaId}/ledger/adjustment`, body)).data,

  reconcileAccount: async (chamaId, accountId, bank_statement_balance) =>
    (
      await apiClient.post(
        `/chamas/${chamaId}/accounts/${accountId}/reconcile`,
        { bank_statement_balance },
      )
    ).data,

  verifyIntegrity: async (chamaId) =>
    (await apiClient.get(`/chamas/${chamaId}/ledger/verify`)).data,
};

export default ledgerApi;
