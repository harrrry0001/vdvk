import { real, index, integer, text, sqliteTable } from "drizzle-orm/sqlite-core";
import { vdvks } from "../master/vdvk-beneficiary";
import { beneficiaries } from "../master/vdvk-beneficiary";
import { commodities } from "../master/commodity-grade-rate";
import { grades } from "../master/commodity-grade-rate";
import { facilities } from "../master/facility";

// ─── FORM 3: PROCESSING (HEADER) ─────────────────────────────────────────
export const form3Processing = sqliteTable("form3_processing", {
  id: text("id").primaryKey(),
  txnNo: text("txn_no").notNull().unique(),
  processingLocationCode: text("processing_location_code").notNull(),
  processingLocationNameSnapshot: text("processing_location_name_snapshot").notNull(),
  processingDate: text("processing_date").notNull(),
  overallRemarks: text("overall_remarks"),
  status: text("status").notNull().default("Draft"),
  approvalRemarks: text("approval_remarks"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  submittedAt: text("submitted_at"),
  createdBy: text("created_by").notNull(),
  createdByRoleSnapshot: text("created_by_role_snapshot").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f3_processing_date: index("idx_f3_processing_date").on(t.processingDate),
  idx_f3_processing_status: index("idx_f3_processing_status").on(t.status),
}));

// ─── FORM 3: PROCESSING ITEMS ────────────────────────────────────────────
export const form3ProcessingItems = sqliteTable("form3_processing_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  processingId: text("processing_id").notNull().references(() => form3Processing.id),
  vdvkCode: text("vdvk_code").notNull().references(() => vdvks.code),
  vdvkNameSnapshot: text("vdvk_name_snapshot").notNull(),
  beneficiaryId: text("beneficiary_id").references(() => beneficiaries.id),
  beneficiaryNameSnapshot: text("beneficiary_name_snapshot"),
  commodityCode: text("commodity_code").notNull().references(() => commodities.code),
  commodityNameSnapshot: text("commodity_name_snapshot").notNull(),
  gradeCode: text("grade_code").references(() => grades.code),
  gradeNameSnapshot: text("grade_name_snapshot"),
  unit: text("unit").notNull(),
  availableStockKg: real("available_stock_kg"),
  qtyTakenKg: real("qty_taken_kg"),
  ratePerKg: real("rate_per_kg"),
  availableStockPcs: real("available_stock_pcs"),
  qtyTakenPcs: real("qty_taken_pcs"),
  ratePerPiece: real("rate_per_piece"),
  rawMaterialValue: real("raw_material_value"),
  finishedKg: real("finished_kg"),
  finishedPcs: real("finished_pcs"),
  finalCostPerKg: real("final_cost_per_kg"),
  finalCostPerPiece: real("final_cost_per_piece"),
  finishedValue: real("finished_value"),
  processingCost: real("processing_cost"),
  valueAddition: real("value_addition"),
  yieldLossKg: real("yield_loss_kg"),
  yieldLossPcs: real("yield_loss_pcs"),
  perUnitProcessingCostKg: real("per_unit_processing_cost_kg"),
  perUnitProcessingCostPc: real("per_unit_processing_cost_pc"),
  remarks: text("remarks"),
  sourceStockLedgerIds: text("source_stock_ledger_ids", { mode: "json" }).$type<number[]>(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f3_items_processing: index("idx_f3_items_processing").on(t.processingId),
  idx_f3_items_commodity: index("idx_f3_items_commodity").on(t.commodityCode),
}));

// ─── FORM 3: PACKAGING DETAILS ───────────────────────────────────────────
export const form3PackagingDetails = sqliteTable("form3_packaging_details", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  processingItemId: integer("processing_item_id").notNull().references(() => form3ProcessingItems.id),
  packetSize: text("packet_size").notNull(),
  numberOfPackets: integer("number_of_packets").notNull(),
  totalQtyKg: real("total_qty_kg"),
  totalQtyPieces: real("total_qty_pieces"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f3_packaging_item: index("idx_f3_packaging_item").on(t.processingItemId),
}));
