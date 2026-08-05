import client from "../client";

export const exportApi = {
  exportStock: () => client.get("/export/stock.csv", { responseType: "blob" }),
  exportAudit: () => client.get("/export/audit.csv", { responseType: "blob" }),
  exportForm: (formType: string, params?: Record<string, string>) =>
    client.get(`/export/forms/${formType}`, { params, responseType: "blob" }),
};
