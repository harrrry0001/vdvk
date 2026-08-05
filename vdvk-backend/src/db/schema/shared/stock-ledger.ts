import { boolean, doublePrecision, index, integer, pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
import { vdvks } from "../master/vdvk-beneficiary";
import { beneficiaries } from "../master/vdvk-beneficiary";
import { commodities } from "../master/commodity-grade-rate";
import { grades } from "../master/commodity-grade-rate";

// ─── STOCK LEDGER (UNIVERSAL INVENTORY) ──────────────────────────────────
// Tracks every stock movement: Collection (+), Processing (-/+), Sales (-), Transfer (-/+)
// Each row represents a specific commodity+grade lot at a specific location
// This is the single source of truth for Available Stock in Forms 2, 3, 4

export const stockLedger = pgTable("stock_ledger", {
  id: serial("id").primaryKey(),
  vdvkCode: varchar("vdvk_code", { length: 64 }).notNull().references(() => vdvks.code),
  vdvkNameSnapshot: varchar("vdvk_name_snapshot", { length: 191 }).notNull(),
  beneficiaryId: varchar("beneficiary_id", { length: 64 }).references(() => beneficiaries.id),
  beneficiaryNameSnapshot: varchar("beneficiary_name_snapshot", { length: 191 }),
  commodityCode: varchar("commodity_code", { length: 64 }).notNull().references(() => commodities.code),
  commodityNameSnapshot: varchar("commodity_name_snapshot", { length: 191 }).notNull(),
  gradeCode: varchar("grade_code", { length: 64 }).references(() => grades.code),
  gradeNameSnapshot: varchar("grade_name_snapshot", { length: 191 }),
  stockType: text("stock_type").notNull(),
  // NOTE: no FK on facility_code on purpose — Form 1 stock is recorded at the
  // VDVK (a vdvk_code is stored here), which is not a row in `facilities`.
  facilityCode: varchar("facility_code", { length: 64 }).notNull(),
  facilityNameSnapshot: varchar("facility_name_snapshot", { length: 191 }).notNull(),
  unit: text("unit").notNull(),
  qtyKg: doublePrecision("qty_kg").notNull().default(0),
  qtyPieces: doublePrecision("qty_pieces").notNull().default(0),
  ratePerKg: doublePrecision("rate_per_kg"),
  ratePerPiece: doublePrecision("rate_per_piece"),
  totalValue: doublePrecision("total_value"),
  // Movement tracking
  sourceTxnType: text("source_txn_type").notNull(),
  sourceTxnId: varchar("source_txn_id", { length: 64 }),
  parentLotId: integer("parent_lot_id"),  // For processed goods: which raw lot was used
  isActive: boolean("is_active").notNull().default(true),
  consumedQtyKg: doublePrecision("consumed_qty_kg").notNull().default(0),
  consumedQtyPieces: doublePrecision("consumed_qty_pieces").notNull().default(0),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
  updatedAt: varchar("updated_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_stock_vdvk: index("idx_stock_vdvk").on(t.vdvkCode),
  idx_stock_commodity: index("idx_stock_commodity").on(t.commodityCode),
  idx_stock_facility: index("idx_stock_facility").on(t.facilityCode),
  idx_stock_active: index("idx_stock_active").on(t.isActive),
  idx_stock_type: index("idx_stock_type").on(t.stockType),
  idx_stock_source: index("idx_stock_source").on(t.sourceTxnType, t.sourceTxnId),
}));

// ─── STOCK MOVEMENT LOG (APPEND-ONLY HISTORY) ────────────────────────────
export const stockMovementLog = pgTable("stock_movement_log", {
  id: serial("id").primaryKey(),
  stockLedgerId: integer("stock_ledger_id").notNull().references(() => stockLedger.id),
  movementType: text("movement_type").notNull(),
  qtyKgChange: doublePrecision("qty_kg_change").notNull().default(0),
  qtyPiecesChange: doublePrecision("qty_pieces_change").notNull().default(0),
  resultingQtyKg: doublePrecision("resulting_qty_kg"),
  resultingQtyPieces: doublePrecision("resulting_qty_pieces"),
  referenceTxnType: varchar("reference_txn_type", { length: 64 }),
  referenceTxnId: varchar("reference_txn_id", { length: 64 }),
  performedBy: varchar("performed_by", { length: 64 }),
  remarks: varchar("remarks", { length: 500 }),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_stock_mvmt_ledger: index("idx_stock_mvmt_ledger").on(t.stockLedgerId),
  idx_stock_mvmt_ref: index("idx_stock_mvmt_ref").on(t.referenceTxnType, t.referenceTxnId),
  idx_stock_mvmt_created: index("idx_stock_mvmt_created").on(t.createdAt),
}));
