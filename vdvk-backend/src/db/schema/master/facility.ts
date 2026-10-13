import { integer, real, index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { vdvks } from "./vdvk-beneficiary";
import { suppliers } from "./scheme-exphead-customer-supplier";
import { mandals } from "./geo-hierarchy";

// ─── FACILITIES ──────────────────────────────────────────────────────────
export const facilities = sqliteTable("facilities", {
  code: text("code").primaryKey(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  schemeCode: text("scheme_code"),
  state: text("state"),
  district: text("district"),
  mandal: text("mandal"),
  village: text("village"),
  address: text("address"),
  pinCode: text("pin_code"),
  dateOfEstablishment: text("date_of_establishment"),
  operationalStatus: text("operational_status").notNull().default("Operational"),
  storageCapacityKg: real("storage_capacity_kg"),
  processingCapacityKgPerDay: real("processing_capacity_kg_per_day"),
  electricityAvailable: integer("electricity_available", { mode: "boolean" }),
  waterFacility: integer("water_facility", { mode: "boolean" }),
  internetConnectivity: integer("internet_connectivity", { mode: "boolean" }),
  otherInfrastructure: text("other_infrastructure"),
  machineryAvailable: integer("machinery_available", { mode: "boolean" }),
  totalFundSanctioned: real("total_fund_sanctioned"),
  totalFundReleased: real("total_fund_released"),
  totalFundUtilised: real("total_fund_utilised"),
  balanceFund: real("balance_fund"),
  // Approval
  status: text("status").notNull().default("Draft"),
  approvalRemarks: text("approval_remarks"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_facilities_type: index("idx_facilities_type").on(t.type),
  idx_facilities_mandal: index("idx_facilities_mandal").on(t.mandal),
  idx_facilities_status: index("idx_facilities_status").on(t.status),
}));

// ─── FACILITY → VDVK MAPPING ─────────────────────────────────────────────
export const facilityVdvkMapping = sqliteTable("facility_vdvk_mapping", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  facilityCode: text("facility_code").notNull().references(() => facilities.code),
  vdvkCode: text("vdvk_code").notNull().references(() => vdvks.code),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_fac_vdvk_fac: index("idx_fac_vdvk_fac").on(t.facilityCode),
  idx_fac_vdvk_vdvk: index("idx_fac_vdvk_vdvk").on(t.vdvkCode),
}));

// ─── FACILITY → SUPERVISOR ASSIGNMENT HISTORY ────────────────────────────
export const facilitySupervisors = sqliteTable("facility_supervisors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  facilityCode: text("facility_code").notNull().references(() => facilities.code),
  supervisorUserId: text("supervisor_user_id").notNull(),
  supervisorNameSnapshot: text("supervisor_name_snapshot").notNull(),
  assignedFrom: text("assigned_from").notNull(),
  assignedTo: text("assigned_to"),
  remarks: text("remarks"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_fac_sup_fac: index("idx_fac_sup_fac").on(t.facilityCode),
  idx_fac_sup_active: index("idx_fac_sup_active").on(t.assignedTo),
}));

// ─── FACILITY COMMODITY MAPPING ──────────────────────────────────────────
export const facilityCommodities = sqliteTable("facility_commodities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  facilityCode: text("facility_code").notNull().references(() => facilities.code),
  commodityCode: text("commodity_code").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});
