import { real, index, sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { vdvks } from "../master/vdvk-beneficiary";
import { beneficiaries } from "../master/vdvk-beneficiary";
import { commodities } from "../master/commodity-grade-rate";
import { grades } from "../master/commodity-grade-rate";

// ─── FORM 1: MFP COLLECTION (HEADER) ─────────────────────────────────────
export const form1Collections = sqliteTable("form1_collections", {
  id: text("id").primaryKey(),
  txnNo: text("txn_no").notNull().unique(),
  vdvkCode: text("vdvk_code").notNull().references(() => vdvks.code),
  vdvkNameSnapshot: text("vdvk_name_snapshot").notNull(),
  collectionDate: text("collection_date").notNull(),
  placeOfSubmission: text("place_of_submission").notNull(),
  transactionType: text("transaction_type").notNull(),
  overallRemarks: text("overall_remarks"),
  status: text("status").notNull().default("Draft"),
  approvalRemarks: text("approval_remarks"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  submittedAt: text("submitted_at"),
  createdByRoleSnapshot: text("created_by_role_snapshot").notNull(),
  createdByMandalSnapshot: text("created_by_mandal_snapshot"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f1_collections_vdvk: index("idx_f1_collections_vdvk").on(t.vdvkCode),
  idx_f1_collections_date: index("idx_f1_collections_date").on(t.collectionDate),
  idx_f1_collections_status: index("idx_f1_collections_status").on(t.status),
  idx_f1_collections_approved: index("idx_f1_collections_approved").on(t.approvedBy, t.approvedAt),
}));

// ─── FORM 1: COLLECTION ITEMS (BENEFICIARY × COMMODITY × GRADE ROWS) ────
export const form1CollectionItems = sqliteTable("form1_collection_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  collectionId: text("collection_id").notNull().references(() => form1Collections.id),
  beneficiaryId: text("beneficiary_id").notNull().references(() => beneficiaries.id),
  beneficiaryNameSnapshot: text("beneficiary_name_snapshot").notNull(),
  commodityCode: text("commodity_code").notNull().references(() => commodities.code),
  commodityNameSnapshot: text("commodity_name_snapshot").notNull(),
  gradeCode: text("grade_code").references(() => grades.code),
  gradeNameSnapshot: text("grade_name_snapshot"),
  unit: text("unit").notNull(),
  unitSnapshot: text("unit_snapshot").notNull(),
  qtyKg: real("qty_kg"),
  qtyPieces: real("qty_pieces"),
  ratePerKg: real("rate_per_kg"),
  ratePerPiece: real("rate_per_piece"),
  rateSnapshot: text("rate_snapshot"),
  totalCost: real("total_cost"),
  remarks: text("remarks"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f1_items_collection: index("idx_f1_items_collection").on(t.collectionId),
  idx_f1_items_beneficiary: index("idx_f1_items_beneficiary").on(t.beneficiaryId),
  idx_f1_items_commodity: index("idx_f1_items_commodity").on(t.commodityCode),
}));
