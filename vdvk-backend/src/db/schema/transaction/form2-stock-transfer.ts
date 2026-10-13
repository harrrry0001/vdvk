import { real, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { vdvks } from "../master/vdvk-beneficiary";
import { beneficiaries } from "../master/vdvk-beneficiary";
import { commodities } from "../master/commodity-grade-rate";
import { grades } from "../master/commodity-grade-rate";
import { facilities } from "../master/facility";

// ─── FORM 2: STOCK TRANSFER (HEADER) ─────────────────────────────────────
export const form2StockTransfers = sqliteTable("form2_stock_transfers", {
  id: text("id").primaryKey(),
  txnNo: text("txn_no").notNull().unique(),
  transferDate: text("transfer_date").notNull(),
  sentFromFacilityCode: text("sent_from_facility_code").notNull(),
  sentFromNameSnapshot: text("sent_from_name_snapshot").notNull(),
  sentToFacilityCode: text("sent_to_facility_code").notNull(),
  sentToNameSnapshot: text("sent_to_name_snapshot").notNull(),
  sentBy: text("sent_by"),
  sentByNameSnapshot: text("sent_by_name_snapshot"),
  vehicleDetails: text("vehicle_details"),
  driverName: text("driver_name"),
  driverMobile: text("driver_mobile"),
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
  idx_f2_transfers_date: index("idx_f2_transfers_date").on(t.transferDate),
  idx_f2_transfers_status: index("idx_f2_transfers_status").on(t.status),
  idx_f2_transfers_from: index("idx_f2_transfers_from").on(t.sentFromFacilityCode),
  idx_f2_transfers_to: index("idx_f2_transfers_to").on(t.sentToFacilityCode),
}));

// ─── FORM 2: STOCK TRANSFER ITEMS ────────────────────────────────────────
export const form2TransferItems = sqliteTable("form2_transfer_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  transferId: text("transfer_id").notNull().references(() => form2StockTransfers.id),
  vdvkCode: text("vdvk_code").notNull().references(() => vdvks.code),
  vdvkNameSnapshot: text("vdvk_name_snapshot").notNull(),
  beneficiaryId: text("beneficiary_id").notNull().references(() => beneficiaries.id),
  beneficiaryNameSnapshot: text("beneficiary_name_snapshot").notNull(),
  commodityCode: text("commodity_code").notNull().references(() => commodities.code),
  commodityNameSnapshot: text("commodity_name_snapshot").notNull(),
  gradeCode: text("grade_code").references(() => grades.code),
  gradeNameSnapshot: text("grade_name_snapshot"),
  goodsType: text("goods_type").notNull(),
  unit: text("unit").notNull(),
  availableKg: real("available_kg"),
  transferQtyKg: real("transfer_qty_kg"),
  availablePieces: real("available_pieces"),
  transferQtyPieces: real("transfer_qty_pieces"),
  ratePerKg: real("rate_per_kg"),
  ratePerPiece: real("rate_per_piece"),
  totalValue: real("total_value"),
  sourceStockLedgerId: integer("source_stock_ledger_id"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f2_items_transfer: index("idx_f2_items_transfer").on(t.transferId),
  idx_f2_items_vdvk: index("idx_f2_items_vdvk").on(t.vdvkCode),
}));
