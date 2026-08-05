import client from "../client";

export const masterApi = {
  getStates: () => client.get("/master/geo/states"),
  getDistricts: (stateCode: string) => client.get(`/master/geo/districts/${stateCode}`),
  getMandals: (districtCode: string) => client.get(`/master/geo/mandals/${districtCode}`),
  getVillages: (mandalCode: string) => client.get(`/master/geo/villages/${mandalCode}`),

  getCommodities: () => client.get("/master/commodities"),
  getCommoditiesActiveOn: (date: string) => client.get(`/master/commodities/active-on/${date}`),
  getGrades: (commodityCode?: string) =>
    client.get("/master/grades", { params: commodityCode ? { commodityCode } : undefined }),
  getRates: (params?: { commodity?: string; grade?: string; date?: string }) =>
    client.get("/master/rates", { params }),

  getSchemes: () => client.get("/master/schemes"),
  getExpenditureHeads: () => client.get("/master/expenditure-heads"),
  getCustomers: () => client.get("/master/customers"),
  getSuppliers: () => client.get("/master/suppliers"),

  getVdvks: () => client.get("/master/vdvks"),
  getVdvkDetail: (code: string) => client.get(`/master/vdvks/${code}`),
};
