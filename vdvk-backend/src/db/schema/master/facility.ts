import { boolean, doublePrecision, index, pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
import { vdvks } from "./vdvk-beneficiary";
import { suppliers } from "./scheme-exphead-customer-supplier";
import { mandals } from "./geo-hierarchy";

// ─── FACILITIES ──────────────────────────────────────────────────────────
export const facilities = pgTable("facilities", {
  code: varchar("code", { length: 64 }).primaryKey(),
  type: text("type").notNull(),
  name: varchar("name", { length: 191 }).notNull(),
  schemeCode: varchar("scheme_code", { length: 64 }),
  state: varchar("state", { length: 64 }),
  district: varchar("district", { length: 64 }),
  mandal: varchar("mandal", { length: 64 }),
  village: varchar("village", { length: 191 }),
  address: varchar("address", { length: 500 }),
  pinCode: varchar("pin_code", { length: 16 }),
  dateOfEstablishment: varchar("date_of_establishment", { length: 64 }),
  operationalStatus: text("operational_status").notNull().default("Operational"),
  storageCapacityKg: doublePrecision("storage_capacity_kg"),
  processingCapacityKgPerDay: doublePrecision("processing_capacity_kg_per_day"),
  electricityAvailable: boolean("electricity_available"),
  waterFacility: boolean("water_facility"),
  internetConnectivity: boolean("internet_connectivity"),
  otherInfrastructure: varchar("other_infrastructure", { length: 500 }),
  machineryAvailable: boolean("machinery_available"),
  totalFundSanctioned: doublePrecision("total_fund_sanctioned"),
  totalFundReleased: doublePrecision("total_fund_released"),
  totalFundUtilised: doublePrecision("total_fund_utilised"),
  balanceFund: doublePrecision("balance_fund"),
  // Approval
  status: text("status").notNull().default("Draft"),
  approvalRemarks: varchar("approval_remarks", { length: 500 }),
  approvedBy: varchar("approved_by", { length: 64 }),
  approvedAt: varchar("approved_at", { length: 64 }),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
  updatedAt: varchar("updated_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_facilities_type: index("idx_facilities_type").on(t.type),
  idx_facilities_mandal: index("idx_facilities_mandal").on(t.mandal),
  idx_facilities_status: index("idx_facilities_status").on(t.status),
}));

// ─── FACILITY → VDVK MAPPING ─────────────────────────────────────────────
export const facilityVdvkMapping = pgTable("facility_vdvk_mapping", {
  id: serial("id").primaryKey(),
  facilityCode: varchar("facility_code", { length: 64 }).notNull().references(() => facilities.code),
  vdvkCode: varchar("vdvk_code", { length: 64 }).notNull().references(() => vdvks.code),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_fac_vdvk_fac: index("idx_fac_vdvk_fac").on(t.facilityCode),
  idx_fac_vdvk_vdvk: index("idx_fac_vdvk_vdvk").on(t.vdvkCode),
}));

// ─── FACILITY → SUPERVISOR ASSIGNMENT HISTORY ────────────────────────────
export const facilitySupervisors = pgTable("facility_supervisors", {
  id: serial("id").primaryKey(),
  facilityCode: varchar("facility_code", { length: 64 }).notNull().references(() => facilities.code),
  supervisorUserId: varchar("supervisor_user_id", { length: 64 }).notNull(),
  supervisorNameSnapshot: varchar("supervisor_name_snapshot", { length: 191 }).notNull(),
  assignedFrom: varchar("assigned_from", { length: 64 }).notNull(),
  assignedTo: varchar("assigned_to", { length: 64 }),
  remarks: varchar("remarks", { length: 500 }),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_fac_sup_fac: index("idx_fac_sup_fac").on(t.facilityCode),
  idx_fac_sup_active: index("idx_fac_sup_active").on(t.assignedTo),
}));

// ─── FACILITY COMMODITY MAPPING ──────────────────────────────────────────
export const facilityCommodities = pgTable("facility_commodities", {
  id: serial("id").primaryKey(),
  facilityCode: varchar("facility_code", { length: 64 }).notNull().references(() => facilities.code),
  commodityCode: varchar("commodity_code", { length: 64 }).notNull(),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
});
