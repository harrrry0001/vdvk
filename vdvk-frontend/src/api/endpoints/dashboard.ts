import client from "../client";

export const dashboardApi = {
  getDistrictOverview: () => client.get("/dashboard/district-overview"),
  getVdvkPerformance: (params?: { from?: string; to?: string }) =>
    client.get("/dashboard/vdvk-performance", { params }),
  getFundMonitoring: () => client.get("/dashboard/fund-monitoring"),
  getRequests: () => client.get("/dashboard/requests"),
  getMachinerySummary: () => client.get("/dashboard/machinery-summary"),
  getCollectionByCommodity: (params?: { from?: string; to?: string }) =>
    client.get("/dashboard/collection-by-commodity", { params }),
  getOperationalTrend: (months = 12) => client.get(`/dashboard/operational-trend?months=${months}`),
  getFacilityPerformance: (type = "Hub", params?: { from?: string; to?: string }) =>
    client.get(`/dashboard/facility-performance?type=${type}`, { params }),
  getCommodityRanking: (params?: { from?: string; to?: string }) =>
    client.get("/dashboard/commodity-ranking", { params }),
  getMandalPerformance: () => client.get("/dashboard/mandal-performance"),
  getMachineryAnalytics: () => client.get("/dashboard/machinery-analytics"),
  getCommodityGrade: (params?: { from?: string; to?: string }) =>
    client.get("/dashboard/commodity-grade", { params }),
  getSalesProductType: (params?: { from?: string; to?: string }) =>
    client.get("/dashboard/sales-product-type", { params }),
  getTopCustomers: (params?: { from?: string; to?: string; limit?: number }) =>
    client.get("/dashboard/top-customers", { params }),
  getFieldVisits: () => client.get("/dashboard/field-visits"),
};
