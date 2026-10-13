import { integer, real, index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { vdvks } from "../master/vdvk-beneficiary";
import { beneficiaries } from "../master/vdvk-beneficiary";
import { commodities } from "../master/commodity-grade-rate";
import { grades } from "../master/commodity-grade-rate";
import { machinery } from "../master/machinery";
import { facilities } from "../master/facility";

// ─── FORM 8: MACHINERY UTILISATION (HEADER) ──────────────────────────────
export const form8Utilisation = sqliteTable("form8_utilisation", {
  id: text("id").primaryKey(),
  txnNo: text("txn_no").notNull().unique(),
  processingDate: text("processing_date").notNull(),
  overallRemarks: text("overall_remarks"),
  status: text("status").notNull().default("Draft"),
  verificationRemarks: text("verification_remarks"),
  verifiedBy: text("verified_by"),
  verifiedAt: text("verified_at"),
  submittedAt: text("submitted_at"),
  createdBy: text("created_by").notNull(),
  createdByRoleSnapshot: text("created_by_role_snapshot").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f8_utilisation_date: index("idx_f8_utilisation_date").on(t.processingDate),
  idx_f8_utilisation_status: index("idx_f8_utilisation_status").on(t.status),
}));

// ─── FORM 8: UTILISATION ITEMS ──────────────────────────────────────────
export const form8UtilisationItems = sqliteTable("form8_utilisation_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  utilisationId: text("utilisation_id").notNull().references(() => form8Utilisation.id),
  locationType: text("location_type").notNull(),
  facilityCode: text("facility_code").references(() => facilities.code),
  facilityNameSnapshot: text("facility_name_snapshot").notNull(),
  vdvkCode: text("vdvk_code"),
  vdvkNameSnapshot: text("vdvk_name_snapshot"),
  mandal: text("mandal"),
  machineryId: text("machinery_id").notNull().references(() => machinery.id),
  machineryNameSnapshot: text("machinery_name_snapshot").notNull(),
  commodityCode: text("commodity_code").notNull(),
  commodityNameSnapshot: text("commodity_name_snapshot").notNull(),
  unit: text("unit").notNull(),
  rawQtyKg: real("raw_qty_kg"),
  rawQtyPcs: real("raw_qty_pcs"),
  packetDetails: text("packet_details"),
  finalOutputKg: real("final_output_kg"),
  finalOutputPcs: real("final_output_pcs"),
  yieldLossKg: real("yield_loss_kg"),
  yieldLossPcs: real("yield_loss_pcs"),
  utilisationHours: real("utilisation_hours"),
  remarks: text("remarks"),
  form3ReferenceId: text("form3_reference_id"),
  toleranceFlagged: integer("tolerance_flagged", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f8_items_utilisation: index("idx_f8_items_utilisation").on(t.utilisationId),
  idx_f8_items_machinery: index("idx_f8_items_machinery").on(t.machineryId),
}));
