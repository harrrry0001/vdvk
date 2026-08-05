export const ROLES = {
  PO: "PO",
  APD: "APD",
  DPM: "DPM",
  APM: "APM",
  MDA: "MDA",
  Admin: "Admin",
  CC: "CC",
  HUB_SUPERVISOR: "Hub Supervisor",
  MPC_SUPERVISOR: "Multipurpose Centre Supervisor",
  HAAT_SUPERVISOR: "Haat Bazaar Supervisor",
  VDVK_HEAD: "VDVK Head",
  VDVK_FACILITY_SUPERVISOR: "VDVK Facility Supervisor",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<string, string> = {
  PO: "Project Officer",
  APD: "Asst. Project Director",
  DPM: "District Project Manager",
  APM: "Asst. Project Manager",
  MDA: "Master Data Administrator",
  Admin: "Administrator",
  CC: "Cluster Coordinator",
  "Hub Supervisor": "Hub Supervisor",
  "Multipurpose Centre Supervisor": "MPC Supervisor",
  "Haat Bazaar Supervisor": "Haat Bazaar Supervisor",
  "VDVK Head": "VDVK Head",
  "VDVK Facility Supervisor": "VDVK Facility Supervisor",
};

export const FORM_STATUS = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  VERIFIED: "Verified",
  ESCALATED: "Escalated",
} as const;

export type FormStatus = (typeof FORM_STATUS)[keyof typeof FORM_STATUS];

export type ExtendedStatus = FormStatus | "In Transit" | "Delivered" | "Pending" | "Active" | "Inactive" | "Elite" | "Stable" | "Warning" | "Critical" | "Operational" | "Maintenance" | "Available" | "In Use" | "Idle";

export const FORM_TYPES = {
  FORM1: "form1",
  FORM2: "form2",
  FORM3: "form3",
  FORM4: "form4",
  FORM5: "form5",
  FORM6: "form6",
  FORM7: "form7",
  FORM8: "form8",
  FORM9: "form9",
  FORM10: "form10",
  FORM11: "form11",
  FORM12: "form12",
} as const;

export type FormType = (typeof FORM_TYPES)[keyof typeof FORM_TYPES];

export const FORM_LABELS: Record<string, string> = {
  form1: "MFP Collection",
  form2: "Stock Transfer",
  form3: "Processing",
  form4: "Sales Entry",
  form5: "VDVK Registration",
  form6: "Beneficiary Registration",
  form7: "Machinery Registration",
  form8: "Machinery Utilisation",
  form9: "Training Register",
  form10: "Fund Utilisation",
  form11: "Facility Registration",
  form12: "Field Visit",
};
