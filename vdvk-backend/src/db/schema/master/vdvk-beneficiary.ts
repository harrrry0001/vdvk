import { boolean, doublePrecision, index, integer, pgTable, serial, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { schemes } from "./scheme-exphead-customer-supplier";

// ─── VDVK MASTER ─────────────────────────────────────────────────────────
export const vdvks = pgTable("vdvks", {
  code: varchar("code", { length: 64 }).primaryKey(),
  schemeCode: varchar("scheme_code", { length: 64 }).notNull().references(() => schemes.code),
  name: varchar("name", { length: 191 }).notNull(),
  state: varchar("state", { length: 64 }).notNull(),
  district: varchar("district", { length: 64 }).notNull(),
  mandal: varchar("mandal", { length: 64 }),
  village: varchar("village", { length: 191 }),
  pinCode: varchar("pin_code", { length: 16 }),
  sanctionDate: varchar("sanction_date", { length: 64 }),
  beneficiaryCount: integer("beneficiary_count").notNull().default(0),
  amountSanctioned: doublePrecision("amount_sanctioned"),
  amountReleased: doublePrecision("amount_released"),
  bankName: varchar("bank_name", { length: 191 }),
  accountNumber: varchar("account_number", { length: 64 }),
  ifsc: varchar("ifsc", { length: 32 }),
  status: text("status").notNull().default("Draft"),
  approvalRemarks: varchar("approval_remarks", { length: 500 }),
  approvedBy: varchar("approved_by", { length: 64 }),
  approvedAt: varchar("approved_at", { length: 64 }),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
  updatedAt: varchar("updated_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_vdvks_scheme: index("idx_vdvks_scheme").on(t.schemeCode),
  idx_vdvks_mandal: index("idx_vdvks_mandal").on(t.mandal),
  idx_vdvks_status: index("idx_vdvks_status").on(t.status),
  uq_vdvk_scheme_mandal: uniqueIndex("uq_vdvk_scheme_mandal").on(t.schemeCode, t.mandal, t.name),
}));

// ─── VDVK COMMODITY MAPPING ──────────────────────────────────────────────
export const vdvkCommodities = pgTable("vdvk_commodities", {
  id: serial("id").primaryKey(),
  vdvkCode: varchar("vdvk_code", { length: 64 }).notNull().references(() => vdvks.code),
  commodityCode: varchar("commodity_code", { length: 64 }).notNull(),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_vdvk_commodities_vdvk: index("idx_vdvk_commodities_vdvk").on(t.vdvkCode),
}));

// ─── BENEFICIARIES ───────────────────────────────────────────────────────
export const beneficiaries = pgTable("beneficiaries", {
  id: varchar("id", { length: 64 }).primaryKey(),
  vdvkCode: varchar("vdvk_code", { length: 64 }).notNull().references(() => vdvks.code),
  name: varchar("name", { length: 191 }).notNull(),
  age: integer("age"),
  gender: text("gender"),
  mobile: varchar("mobile", { length: 32 }),
  aadhaar: varchar("aadhaar", { length: 64 }),
  address: varchar("address", { length: 500 }),
  state: varchar("state", { length: 64 }),
  district: varchar("district", { length: 64 }),
  mandal: varchar("mandal", { length: 64 }).notNull(),
  village: varchar("village", { length: 191 }),
  pinCode: varchar("pin_code", { length: 16 }),
  category: text("category"),
  registrationMode: text("registration_mode").notNull().default("Individual"),
  hasIncompleteDetails: boolean("has_incomplete_details").notNull().default(false),
  status: text("status").notNull().default("Draft"),
  approvalRemarks: varchar("approval_remarks", { length: 500 }),
  approvedBy: varchar("approved_by", { length: 64 }),
  approvedAt: varchar("approved_at", { length: 64 }),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
  updatedAt: varchar("updated_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_ben_vdvk: index("idx_ben_vdvk").on(t.vdvkCode),
  idx_ben_mandal: index("idx_ben_mandal").on(t.mandal),
  idx_ben_status: index("idx_ben_status").on(t.status),
  uq_aadhaar: uniqueIndex("uq_aadhaar").on(t.aadhaar),
}));

// ─── BENEFICIARY COMMODITY MAPPING ───────────────────────────────────────
export const beneficiaryCommodities = pgTable("beneficiary_commodities", {
  id: serial("id").primaryKey(),
  beneficiaryId: varchar("beneficiary_id", { length: 64 }).notNull().references(() => beneficiaries.id),
  commodityCode: varchar("commodity_code", { length: 64 }).notNull(),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_ben_commodities_ben: index("idx_ben_commodities_ben").on(t.beneficiaryId),
}));
