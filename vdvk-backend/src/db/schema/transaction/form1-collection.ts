import { doublePrecision, index, pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
import { vdvks } from "../master/vdvk-beneficiary";
import { beneficiaries } from "../master/vdvk-beneficiary";
import { commodities } from "../master/commodity-grade-rate";
import { grades } from "../master/commodity-grade-rate";

// ─── FORM 1: MFP COLLECTION (HEADER) ─────────────────────────────────────
export const form1Collections = pgTable("form1_collections", {
  id: varchar("id", { length: 64 }).primaryKey(),
  txnNo: varchar("txn_no", { length: 64 }).notNull().unique(),
  vdvkCode: varchar("vdvk_code", { length: 64 }).notNull().references(() => vdvks.code),
  vdvkNameSnapshot: varchar("vdvk_name_snapshot", { length: 191 }).notNull(),
  collectionDate: varchar("collection_date", { length: 64 }).notNull(),
  placeOfSubmission: text("place_of_submission").notNull(),
  transactionType: text("transaction_type").notNull(),
  overallRemarks: varchar("overall_remarks", { length: 500 }),
  status: text("status").notNull().default("Draft"),
  approvalRemarks: varchar("approval_remarks", { length: 500 }),
  approvedBy: varchar("approved_by", { length: 64 }),
  approvedAt: varchar("approved_at", { length: 64 }),
  submittedAt: varchar("submitted_at", { length: 64 }),
  createdByRoleSnapshot: varchar("created_by_role_snapshot", { length: 64 }).notNull(),
  createdByMandalSnapshot: varchar("created_by_mandal_snapshot", { length: 64 }),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
  updatedAt: varchar("updated_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f1_collections_vdvk: index("idx_f1_collections_vdvk").on(t.vdvkCode),
  idx_f1_collections_date: index("idx_f1_collections_date").on(t.collectionDate),
  idx_f1_collections_status: index("idx_f1_collections_status").on(t.status),
  idx_f1_collections_approved: index("idx_f1_collections_approved").on(t.approvedBy, t.approvedAt),
}));

// ─── FORM 1: COLLECTION ITEMS (BENEFICIARY × COMMODITY × GRADE ROWS) ────
export const form1CollectionItems = pgTable("form1_collection_items", {
  id: serial("id").primaryKey(),
  collectionId: varchar("collection_id", { length: 64 }).notNull().references(() => form1Collections.id),
  beneficiaryId: varchar("beneficiary_id", { length: 64 }).notNull().references(() => beneficiaries.id),
  beneficiaryNameSnapshot: varchar("beneficiary_name_snapshot", { length: 191 }).notNull(),
  commodityCode: varchar("commodity_code", { length: 64 }).notNull().references(() => commodities.code),
  commodityNameSnapshot: varchar("commodity_name_snapshot", { length: 191 }).notNull(),
  gradeCode: varchar("grade_code", { length: 64 }).references(() => grades.code),
  gradeNameSnapshot: varchar("grade_name_snapshot", { length: 191 }),
  unit: text("unit").notNull(),
  unitSnapshot: varchar("unit_snapshot", { length: 32 }).notNull(),
  qtyKg: doublePrecision("qty_kg"),
  qtyPieces: doublePrecision("qty_pieces"),
  ratePerKg: doublePrecision("rate_per_kg"),
  ratePerPiece: doublePrecision("rate_per_piece"),
  rateSnapshot: varchar("rate_snapshot", { length: 191 }),
  totalCost: doublePrecision("total_cost"),
  remarks: varchar("remarks", { length: 500 }),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f1_items_collection: index("idx_f1_items_collection").on(t.collectionId),
  idx_f1_items_beneficiary: index("idx_f1_items_beneficiary").on(t.beneficiaryId),
  idx_f1_items_commodity: index("idx_f1_items_commodity").on(t.commodityCode),
}));
