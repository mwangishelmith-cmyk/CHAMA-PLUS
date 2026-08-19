import apiClient from "./client";

/** Dashboard API calls (protected — access token attached by the interceptor). */
export const dashboardApi = {
  /** GET /dashboard/summary -> { stats, activity } */
  summary: async () => {
    const { data } = await apiClient.get("/dashboard/summary");
    return data;
  },
};

export default dashboardApi;
