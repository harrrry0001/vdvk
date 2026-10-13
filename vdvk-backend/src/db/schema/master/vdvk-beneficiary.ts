import { integer, real, index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { schemes } from "./scheme-exphead-customer-supplier";

// ─── VDVK MASTER ─────────────────────────────────────────────────────────
export const vdvks = sqliteTable("vdvks", {
  code: text("code").primaryKey(),
  schemeCode: text("scheme_code").notNull().references(() => schemes.code),
  name: text("name").notNull(),
  state: text("state").notNull(),
  district: text("district").notNull(),
  mandal: text("mandal"),
  village: text("village"),
  pinCode: text("pin_code"),
  sanctionDate: text("sanction_date"),
  beneficiaryCount: integer("beneficiary_count").notNull().default(0),
  amountSanctioned: real("amount_sanctioned"),
  amountReleased: real("amount_released"),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  ifsc: text("ifsc"),
  status: text("status").notNull().default("Draft"),
  approvalRemarks: text("approval_remarks"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_vdvks_scheme: index("idx_vdvks_scheme").on(t.schemeCode),
  idx_vdvks_mandal: index("idx_vdvks_mandal").on(t.mandal),
  idx_vdvks_status: index("idx_vdvks_status").on(t.status),
  uq_vdvk_scheme_mandal: uniqueIndex("uq_vdvk_scheme_mandal").on(t.schemeCode, t.mandal, t.name),
}));

// ─── VDVK COMMODITY MAPPING ──────────────────────────────────────────────
export const vdvkCommodities = sqliteTable("vdvk_commodities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vdvkCode: text("vdvk_code").notNull().references(() => vdvks.code),
  commodityCode: text("commodity_code").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_vdvk_commodities_vdvk: index("idx_vdvk_commodities_vdvk").on(t.vdvkCode),
}));

// ─── BENEFICIARIES ───────────────────────────────────────────────────────
export const beneficiaries = sqliteTable("beneficiaries", {
  id: text("id").primaryKey(),
  vdvkCode: text("vdvk_code").notNull().references(() => vdvks.code),
  name: text("name").notNull(),
  age: integer("age"),
  gender: text("gender"),
  mobile: text("mobile"),
  aadhaar: text("aadhaar"),
  address: text("address"),
  state: text("state"),
  district: text("district"),
  mandal: text("mandal").notNull(),
  village: text("village"),
  pinCode: text("pin_code"),
  category: text("category"),
  registrationMode: text("registration_mode").notNull().default("Individual"),
  hasIncompleteDetails: integer("has_incomplete_details", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("Draft"),
  approvalRemarks: text("approval_remarks"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  // ── field-data integration (nullable; see integration/README.md) ──
  // Present in Turso via integration/backend/apply-extension-libsql.cjs —
  // declared here so `drizzle-kit push` sees them as owned columns.
  referenceId: text("reference_id"),
  dateOfBirth: text("date_of_birth"),
  shgName: text("shg_name"),
  tribe: text("tribe"),
  education: text("education"),
  occupation: text("occupation"),
  bankName: text("bank_name"),
  ifsc: text("ifsc"),
  accountNumber: text("account_number"),
  financialYear: text("financial_year"),
  gramPanchayat: text("gram_panchayat"),
  importFlags: text("import_flags"),
  sourceFile: text("source_file"),
  sourceSheet: text("source_sheet"),
  proposedVdvk: text("proposed_vdvk"),
}, (t) => ({
  idx_ben_vdvk: index("idx_ben_vdvk").on(t.vdvkCode),
  idx_ben_mandal: index("idx_ben_mandal").on(t.mandal),
  idx_ben_status: index("idx_ben_status").on(t.status),
  uq_aadhaar: uniqueIndex("uq_aadhaar").on(t.aadhaar),
}));

// ─── BENEFICIARY COMMODITY MAPPING ───────────────────────────────────────
export const beneficiaryCommodities = sqliteTable("beneficiary_commodities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  beneficiaryId: text("beneficiary_id").notNull().references(() => beneficiaries.id),
  commodityCode: text("commodity_code").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_ben_commodities_ben: index("idx_ben_commodities_ben").on(t.beneficiaryId),
}));
