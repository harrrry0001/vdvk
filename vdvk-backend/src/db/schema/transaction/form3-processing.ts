import { doublePrecision, index, integer, jsonb, pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
import { vdvks } from "../master/vdvk-beneficiary";
import { beneficiaries } from "../master/vdvk-beneficiary";
import { commodities } from "../master/commodity-grade-rate";
import { grades } from "../master/commodity-grade-rate";
import { facilities } from "../master/facility";

// ─── FORM 3: PROCESSING (HEADER) ─────────────────────────────────────────
export const form3Processing = pgTable("form3_processing", {
  id: varchar("id", { length: 64 }).primaryKey(),
  txnNo: varchar("txn_no", { length: 64 }).notNull().unique(),
  processingLocationCode: varchar("processing_location_code", { length: 64 }).notNull(),
  processingLocationNameSnapshot: varchar("processing_location_name_snapshot", { length: 191 }).notNull(),
  processingDate: varchar("processing_date", { length: 64 }).notNull(),
  overallRemarks: varchar("overall_remarks", { length: 500 }),
  status: text("status").notNull().default("Draft"),
  approvalRemarks: varchar("approval_remarks", { length: 500 }),
  approvedBy: varchar("approved_by", { length: 64 }),
  approvedAt: varchar("approved_at", { length: 64 }),
  submittedAt: varchar("submitted_at", { length: 64 }),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdByRoleSnapshot: varchar("created_by_role_snapshot", { length: 64 }).notNull(),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
  updatedAt: varchar("updated_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f3_processing_date: index("idx_f3_processing_date").on(t.processingDate),
  idx_f3_processing_status: index("idx_f3_processing_status").on(t.status),
}));

// ─── FORM 3: PROCESSING ITEMS ────────────────────────────────────────────
export const form3ProcessingItems = pgTable("form3_processing_items", {
  id: serial("id").primaryKey(),
  processingId: varchar("processing_id", { length: 64 }).notNull().references(() => form3Processing.id),
  vdvkCode: varchar("vdvk_code", { length: 64 }).notNull().references(() => vdvks.code),
  vdvkNameSnapshot: varchar("vdvk_name_snapshot", { length: 191 }).notNull(),
  beneficiaryId: varchar("beneficiary_id", { length: 64 }).references(() => beneficiaries.id),
  beneficiaryNameSnapshot: varchar("beneficiary_name_snapshot", { length: 191 }),
  commodityCode: varchar("commodity_code", { length: 64 }).notNull().references(() => commodities.code),
  commodityNameSnapshot: varchar("commodity_name_snapshot", { length: 191 }).notNull(),
  gradeCode: varchar("grade_code", { length: 64 }).references(() => grades.code),
  gradeNameSnapshot: varchar("grade_name_snapshot", { length: 191 }),
  unit: text("unit").notNull(),
  availableStockKg: doublePrecision("available_stock_kg"),
  qtyTakenKg: doublePrecision("qty_taken_kg"),
  ratePerKg: doublePrecision("rate_per_kg"),
  availableStockPcs: doublePrecision("available_stock_pcs"),
  qtyTakenPcs: doublePrecision("qty_taken_pcs"),
  ratePerPiece: doublePrecision("rate_per_piece"),
  rawMaterialValue: doublePrecision("raw_material_value"),
  finishedKg: doublePrecision("finished_kg"),
  finishedPcs: doublePrecision("finished_pcs"),
  finalCostPerKg: doublePrecision("final_cost_per_kg"),
  finalCostPerPiece: doublePrecision("final_cost_per_piece"),
  finishedValue: doublePrecision("finished_value"),
  processingCost: doublePrecision("processing_cost"),
  valueAddition: doublePrecision("value_addition"),
  yieldLossKg: doublePrecision("yield_loss_kg"),
  yieldLossPcs: doublePrecision("yield_loss_pcs"),
  perUnitProcessingCostKg: doublePrecision("per_unit_processing_cost_kg"),
  perUnitProcessingCostPc: doublePrecision("per_unit_processing_cost_pc"),
  remarks: varchar("remarks", { length: 500 }),
  sourceStockLedgerIds: jsonb("source_stock_ledger_ids").$type<number[]>(),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f3_items_processing: index("idx_f3_items_processing").on(t.processingId),
  idx_f3_items_commodity: index("idx_f3_items_commodity").on(t.commodityCode),
}));

// ─── FORM 3: PACKAGING DETAILS ───────────────────────────────────────────
export const form3PackagingDetails = pgTable("form3_packaging_details", {
  id: serial("id").primaryKey(),
  processingItemId: integer("processing_item_id").notNull().references(() => form3ProcessingItems.id),
  packetSize: varchar("packet_size", { length: 64 }).notNull(),
  numberOfPackets: integer("number_of_packets").notNull(),
  totalQtyKg: doublePrecision("total_qty_kg"),
  totalQtyPieces: doublePrecision("total_qty_pieces"),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f3_packaging_item: index("idx_f3_packaging_item").on(t.processingItemId),
}));
