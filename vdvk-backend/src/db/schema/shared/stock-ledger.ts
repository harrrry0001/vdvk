import { integer, real, index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { vdvks } from "../master/vdvk-beneficiary";
import { beneficiaries } from "../master/vdvk-beneficiary";
import { commodities } from "../master/commodity-grade-rate";
import { grades } from "../master/commodity-grade-rate";

// ─── STOCK LEDGER (UNIVERSAL INVENTORY) ──────────────────────────────────
// Tracks every stock movement: Collection (+), Processing (-/+), Sales (-), Transfer (-/+)
// Each row represents a specific commodity+grade lot at a specific location
// This is the single source of truth for Available Stock in Forms 2, 3, 4

export const stockLedger = sqliteTable("stock_ledger", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vdvkCode: text("vdvk_code").notNull().references(() => vdvks.code),
  vdvkNameSnapshot: text("vdvk_name_snapshot").notNull(),
  beneficiaryId: text("beneficiary_id").references(() => beneficiaries.id),
  beneficiaryNameSnapshot: text("beneficiary_name_snapshot"),
  commodityCode: text("commodity_code").notNull().references(() => commodities.code),
  commodityNameSnapshot: text("commodity_name_snapshot").notNull(),
  gradeCode: text("grade_code").references(() => grades.code),
  gradeNameSnapshot: text("grade_name_snapshot"),
  stockType: text("stock_type").notNull(),
  // NOTE: no FK on facility_code on purpose — Form 1 stock is recorded at the
  // VDVK (a vdvk_code is stored here), which is not a row in `facilities`.
  facilityCode: text("facility_code").notNull(),
  facilityNameSnapshot: text("facility_name_snapshot").notNull(),
  unit: text("unit").notNull(),
  qtyKg: real("qty_kg").notNull().default(0),
  qtyPieces: real("qty_pieces").notNull().default(0),
  ratePerKg: real("rate_per_kg"),
  ratePerPiece: real("rate_per_piece"),
  totalValue: real("total_value"),
  // Movement tracking
  sourceTxnType: text("source_txn_type").notNull(),
  sourceTxnId: text("source_txn_id"),
  parentLotId: integer("parent_lot_id"),  // For processed goods: which raw lot was used
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  consumedQtyKg: real("consumed_qty_kg").notNull().default(0),
  consumedQtyPieces: real("consumed_qty_pieces").notNull().default(0),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_stock_vdvk: index("idx_stock_vdvk").on(t.vdvkCode),
  idx_stock_commodity: index("idx_stock_commodity").on(t.commodityCode),
  idx_stock_facility: index("idx_stock_facility").on(t.facilityCode),
  idx_stock_active: index("idx_stock_active").on(t.isActive),
  idx_stock_type: index("idx_stock_type").on(t.stockType),
  idx_stock_source: index("idx_stock_source").on(t.sourceTxnType, t.sourceTxnId),
}));

// ─── STOCK MOVEMENT LOG (APPEND-ONLY HISTORY) ────────────────────────────
export const stockMovementLog = sqliteTable("stock_movement_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  stockLedgerId: integer("stock_ledger_id").notNull().references(() => stockLedger.id),
  movementType: text("movement_type").notNull(),
  qtyKgChange: real("qty_kg_change").notNull().default(0),
  qtyPiecesChange: real("qty_pieces_change").notNull().default(0),
  resultingQtyKg: real("resulting_qty_kg"),
  resultingQtyPieces: real("resulting_qty_pieces"),
  referenceTxnType: text("reference_txn_type"),
  referenceTxnId: text("reference_txn_id"),
  performedBy: text("performed_by"),
  remarks: text("remarks"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_stock_mvmt_ledger: index("idx_stock_mvmt_ledger").on(t.stockLedgerId),
  idx_stock_mvmt_ref: index("idx_stock_mvmt_ref").on(t.referenceTxnType, t.referenceTxnId),
  idx_stock_mvmt_created: index("idx_stock_mvmt_created").on(t.createdAt),
}));
