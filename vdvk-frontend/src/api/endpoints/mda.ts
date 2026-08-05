import client from "../client";

export const mdaApi = {
  getStock: (params?: Record<string, string>) => client.get("/mda/stock", { params }),
  getStockSummary: () => client.get("/mda/stock/summary"),
  getStockMovements: (params?: Record<string, string>) =>
    client.get("/mda/stock/movements", { params }),

  getAllRates: () => client.get("/mda/rates/all"),
  getRatePrefill: (params: { commodity: string; grade: string; date: string }) =>
    client.get("/mda/rates/prefill", { params }),
  createRate: (data: unknown) => client.post("/mda/rates", data),
  reviseRate: (id: string, data: unknown) => client.put(`/mda/rates/${id}/revise`, data),

  crud: (entity: string) => ({
    list: () => client.get(`/mda/${entity}`),
    create: (data: unknown) => client.post(`/mda/${entity}`, data),
    update: (id: string, data: unknown) => client.put(`/mda/${entity}/${id}`, data),
    delete: (id: string) => client.delete(`/mda/${entity}/${id}`),
  }),

  getUsers: () => client.get("/mda/users"),
  getUserDetail: (id: string) => client.get(`/mda/users/${id}`),
  createUser: (data: unknown) => client.post("/mda/users", data),
  deactivateUser: (id: string) => client.patch(`/mda/users/${id}/deactivate`),
  resetPassword: (id: string, data: { newPassword: string }) =>
    client.patch(`/mda/users/${id}/reset-password`, data),
  transferUser: (id: string, data: unknown) => client.patch(`/mda/users/${id}/transfer`, data),

  getAuditTrail: (params?: Record<string, string>) => client.get("/mda/audit-trail", { params }),
  getRejectedRecords: (params?: Record<string, string>) =>
    client.get("/mda/rejected-records", { params }),

  transferMachinery: (id: string, data: unknown) =>
    client.post(`/mda/machinery/${id}/transfer`, data),
  completeMachineryTransfer: (id: string, data: unknown) =>
    client.patch(`/mda/machinery/${id}/complete-transfer`, data),

  getFacilitiesByType: (type?: string) =>
    client.get("/mda/facilities/by-type", { params: type ? { type } : undefined }),
  getFacilityCommodities: (code: string) => client.get(`/mda/facilities/${code}/commodities`),
  addFacilityCommodity: (code: string, data: unknown) =>
    client.post(`/mda/facilities/${code}/commodities`, data),
  getFacilityVdvks: (code: string) => client.get(`/mda/facilities/${code}/vdvks`),
  addFacilityVdvk: (code: string, data: unknown) =>
    client.post(`/mda/facilities/${code}/vdvks`, data),
  getFacilitySupervisors: (code: string) => client.get(`/mda/facilities/${code}/supervisors`),
  addFacilitySupervisor: (code: string, data: unknown) =>
    client.post(`/mda/facilities/${code}/supervisors`, data),
  getFacilitiesByVdvk: (vdvkCode: string) => client.get(`/mda/facilities/by-vdvk/${vdvkCode}`),
};
