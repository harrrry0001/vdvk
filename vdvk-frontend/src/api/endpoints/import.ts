import client from "../client";

export const importApi = {
  importCommodities: (formData: FormData) =>
    client.post("/import/commodities", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  importGrades: (formData: FormData) =>
    client.post("/import/grades", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  importVdvks: (formData: FormData) =>
    client.post("/import/vdvks", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  importUsers: (formData: FormData) =>
    client.post("/import/users", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getImportLogs: () => client.get("/import/logs"),
};
