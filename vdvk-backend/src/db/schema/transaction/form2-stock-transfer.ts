import { doublePrecision, index, integer, pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
import { vdvks } from "../master/vdvk-beneficiary";
import { beneficiaries } from "../master/vdvk-beneficiary";
import { commodities } from "../master/commodity-grade-rate";
import { grades } from "../master/commodity-grade-rate";
import { facilities } from "../master/facility";

// ─── FORM 2: STOCK TRANSFER (HEADER) ─────────────────────────────────────
export const form2StockTransfers = pgTable("form2_stock_transfers", {
  id: varchar("id", { length: 64 }).primaryKey(),
  txnNo: varchar("txn_no", { length: 64 }).notNull().unique(),
  transferDate: varchar("transfer_date", { length: 64 }).notNull(),
  sentFromFacilityCode: varchar("sent_from_facility_code", { length: 64 }).notNull(),
  sentFromNameSnapshot: varchar("sent_from_name_snapshot", { length: 191 }).notNull(),
  sentToFacilityCode: varchar("sent_to_facility_code", { length: 64 }).notNull(),
  sentToNameSnapshot: varchar("sent_to_name_snapshot", { length: 191 }).notNull(),
  sentBy: varchar("sent_by", { length: 64 }),
  sentByNameSnapshot: varchar("sent_by_name_snapshot", { length: 191 }),
  vehicleDetails: varchar("vehicle_details", { length: 191 }),
  driverName: varchar("driver_name", { length: 191 }),
  driverMobile: varchar("driver_mobile", { length: 32 }),
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
  idx_f2_transfers_date: index("idx_f2_transfers_date").on(t.transferDate),
  idx_f2_transfers_status: index("idx_f2_transfers_status").on(t.status),
  idx_f2_transfers_from: index("idx_f2_transfers_from").on(t.sentFromFacilityCode),
  idx_f2_transfers_to: index("idx_f2_transfers_to").on(t.sentToFacilityCode),
}));

// ─── FORM 2: STOCK TRANSFER ITEMS ────────────────────────────────────────
export const form2TransferItems = pgTable("form2_transfer_items", {
  id: serial("id").primaryKey(),
  transferId: varchar("transfer_id", { length: 64 }).notNull().references(() => form2StockTransfers.id),
  vdvkCode: varchar("vdvk_code", { length: 64 }).notNull().references(() => vdvks.code),
  vdvkNameSnapshot: varchar("vdvk_name_snapshot", { length: 191 }).notNull(),
  beneficiaryId: varchar("beneficiary_id", { length: 64 }).notNull().references(() => beneficiaries.id),
  beneficiaryNameSnapshot: varchar("beneficiary_name_snapshot", { length: 191 }).notNull(),
  commodityCode: varchar("commodity_code", { length: 64 }).notNull().references(() => commodities.code),
  commodityNameSnapshot: varchar("commodity_name_snapshot", { length: 191 }).notNull(),
  gradeCode: varchar("grade_code", { length: 64 }).references(() => grades.code),
  gradeNameSnapshot: varchar("grade_name_snapshot", { length: 191 }),
  goodsType: text("goods_type").notNull(),
  unit: text("unit").notNull(),
  availableKg: doublePrecision("available_kg"),
  transferQtyKg: doublePrecision("transfer_qty_kg"),
  availablePieces: doublePrecision("available_pieces"),
  transferQtyPieces: doublePrecision("transfer_qty_pieces"),
  ratePerKg: doublePrecision("rate_per_kg"),
  ratePerPiece: doublePrecision("rate_per_piece"),
  totalValue: doublePrecision("total_value"),
  sourceStockLedgerId: integer("source_stock_ledger_id"),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f2_items_transfer: index("idx_f2_items_transfer").on(t.transferId),
  idx_f2_items_vdvk: index("idx_f2_items_vdvk").on(t.vdvkCode),
}));
