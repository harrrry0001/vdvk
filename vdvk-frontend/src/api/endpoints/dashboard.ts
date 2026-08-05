import client from "../client";

export const dashboardApi = {
  getDistrictOverview: () => client.get("/dashboard/district-overview"),
  getCommodityPerformance: () => client.get("/dashboard/commodity-performance"),
  getVdvkPerformance: () => client.get("/dashboard/vdvk-performance"),
  getFundMonitoring: () => client.get("/dashboard/fund-monitoring"),
  getRequests: () => client.get("/dashboard/requests"),
  getMachinerySummary: () => client.get("/dashboard/machinery-summary"),
};
