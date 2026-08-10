import client from "../client";

const formEndpoint = (formType: string) => `/forms/${formType}`;

export const formsApi = {
  list: (formType: string, params?: Record<string, string>) =>
    client.get(formEndpoint(formType), { params }),

  getById: (formType: string, id: string) =>
    client.get(`${formEndpoint(formType)}/${id}`),

  create: (formType: string, data: unknown) =>
    client.post(formEndpoint(formType), data),

  update: (formType: string, id: string, data: unknown) =>
    client.put(`${formEndpoint(formType)}/${id}`, data),

  submit: (formType: string, id: string) =>
    client.patch(`${formEndpoint(formType)}/${id}/submit`),

  approve: (formType: string, id: string, remarks?: string) =>
    client.patch(`${formEndpoint(formType)}/${id}/approve`, { approved: true, remarks }),

  reject: (formType: string, id: string, remarks: string) =>
    client.patch(`${formEndpoint(formType)}/${id}/approve`, { approved: false, remarks }),

  reopen: (formType: string, id: string) =>
    client.patch(`${formEndpoint(formType)}/${id}/reopen`),

  delete: (formType: string, id: string) =>
    client.delete(`${formEndpoint(formType)}/${id}`),

  importBeneficiaries: (formData: FormData) =>
    client.post("/forms/form6/import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  bulkRegisterBeneficiaries: (data: { vdvkCode: string; beneficiaries: unknown[] }) =>
    client.post("/forms/form6/bulk", data),
};
