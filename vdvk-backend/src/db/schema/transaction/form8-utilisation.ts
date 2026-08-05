import { boolean, doublePrecision, index, pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
import { vdvks } from "../master/vdvk-beneficiary";
import { beneficiaries } from "../master/vdvk-beneficiary";
import { commodities } from "../master/commodity-grade-rate";
import { grades } from "../master/commodity-grade-rate";
import { machinery } from "../master/machinery";
import { facilities } from "../master/facility";

// ─── FORM 8: MACHINERY UTILISATION (HEADER) ──────────────────────────────
export const form8Utilisation = pgTable("form8_utilisation", {
  id: varchar("id", { length: 64 }).primaryKey(),
  txnNo: varchar("txn_no", { length: 64 }).notNull().unique(),
  processingDate: varchar("processing_date", { length: 64 }).notNull(),
  overallRemarks: varchar("overall_remarks", { length: 500 }),
  status: text("status").notNull().default("Draft"),
  verificationRemarks: varchar("verification_remarks", { length: 500 }),
  verifiedBy: varchar("verified_by", { length: 64 }),
  verifiedAt: varchar("verified_at", { length: 64 }),
  submittedAt: varchar("submitted_at", { length: 64 }),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdByRoleSnapshot: varchar("created_by_role_snapshot", { length: 64 }).notNull(),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
  updatedAt: varchar("updated_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f8_utilisation_date: index("idx_f8_utilisation_date").on(t.processingDate),
  idx_f8_utilisation_status: index("idx_f8_utilisation_status").on(t.status),
}));

// ─── FORM 8: UTILISATION ITEMS ──────────────────────────────────────────
export const form8UtilisationItems = pgTable("form8_utilisation_items", {
  id: serial("id").primaryKey(),
  utilisationId: varchar("utilisation_id", { length: 64 }).notNull().references(() => form8Utilisation.id),
  locationType: text("location_type").notNull(),
  facilityCode: varchar("facility_code", { length: 64 }).references(() => facilities.code),
  facilityNameSnapshot: varchar("facility_name_snapshot", { length: 191 }).notNull(),
  vdvkCode: varchar("vdvk_code", { length: 64 }),
  vdvkNameSnapshot: varchar("vdvk_name_snapshot", { length: 191 }),
  mandal: varchar("mandal", { length: 64 }),
  machineryId: varchar("machinery_id", { length: 64 }).notNull().references(() => machinery.id),
  machineryNameSnapshot: varchar("machinery_name_snapshot", { length: 191 }).notNull(),
  commodityCode: varchar("commodity_code", { length: 64 }).notNull(),
  commodityNameSnapshot: varchar("commodity_name_snapshot", { length: 191 }).notNull(),
  unit: text("unit").notNull(),
  rawQtyKg: doublePrecision("raw_qty_kg"),
  rawQtyPcs: doublePrecision("raw_qty_pcs"),
  packetDetails: varchar("packet_details", { length: 500 }),
  finalOutputKg: doublePrecision("final_output_kg"),
  finalOutputPcs: doublePrecision("final_output_pcs"),
  yieldLossKg: doublePrecision("yield_loss_kg"),
  yieldLossPcs: doublePrecision("yield_loss_pcs"),
  utilisationHours: doublePrecision("utilisation_hours"),
  remarks: varchar("remarks", { length: 500 }),
  form3ReferenceId: varchar("form3_reference_id", { length: 64 }),
  toleranceFlagged: boolean("tolerance_flagged").notNull().default(false),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f8_items_utilisation: index("idx_f8_items_utilisation").on(t.utilisationId),
  idx_f8_items_machinery: index("idx_f8_items_machinery").on(t.machineryId),
}));
