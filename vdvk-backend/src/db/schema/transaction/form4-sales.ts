import { doublePrecision, index, integer, jsonb, pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
import { vdvks } from "../master/vdvk-beneficiary";
import { beneficiaries } from "../master/vdvk-beneficiary";
import { commodities } from "../master/commodity-grade-rate";
import { grades } from "../master/commodity-grade-rate";
import { customers } from "../master/scheme-exphead-customer-supplier";
import { facilities } from "../master/facility";

// ─── FORM 4: SALES (HEADER) ──────────────────────────────────────────────
export const form4Sales = pgTable("form4_sales", {
  id: varchar("id", { length: 64 }).primaryKey(),
  txnNo: varchar("txn_no", { length: 64 }).notNull().unique(),
  saleLocationCode: varchar("sale_location_code", { length: 64 }).notNull(),
  saleLocationNameSnapshot: varchar("sale_location_name_snapshot", { length: 191 }).notNull(),
  saleDate: varchar("sale_date", { length: 64 }).notNull(),
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
  idx_f4_sales_date: index("idx_f4_sales_date").on(t.saleDate),
  idx_f4_sales_status: index("idx_f4_sales_status").on(t.status),
}));

// ─── FORM 4: SALES ITEMS ─────────────────────────────────────────────────
export const form4SalesItems = pgTable("form4_sales_items", {
  id: serial("id").primaryKey(),
  salesId: varchar("sales_id", { length: 64 }).notNull().references(() => form4Sales.id),
  customerCode: varchar("customer_code", { length: 64 }).notNull().references(() => customers.code),
  customerNameSnapshot: varchar("customer_name_snapshot", { length: 191 }).notNull(),
  customerMobileSnapshot: varchar("customer_mobile_snapshot", { length: 32 }),
  invoiceNo: varchar("invoice_no", { length: 64 }).notNull(),
  vdvkCode: varchar("vdvk_code", { length: 64 }).notNull().references(() => vdvks.code),
  vdvkNameSnapshot: varchar("vdvk_name_snapshot", { length: 191 }).notNull(),
  beneficiaryId: varchar("beneficiary_id", { length: 64 }).references(() => beneficiaries.id),
  beneficiaryNameSnapshot: varchar("beneficiary_name_snapshot", { length: 191 }),
  productType: text("product_type").notNull(),
  commodityCode: varchar("commodity_code", { length: 64 }).notNull().references(() => commodities.code),
  commodityNameSnapshot: varchar("commodity_name_snapshot", { length: 191 }).notNull(),
  gradeCode: varchar("grade_code", { length: 64 }).references(() => grades.code),
  gradeNameSnapshot: varchar("grade_name_snapshot", { length: 191 }),
  salesUnit: text("sales_unit").notNull(),
  availableKg: doublePrecision("available_kg"),
  availablePcs: doublePrecision("available_pcs"),
  packetDetails: varchar("packet_details", { length: 500 }),
  soldKg: doublePrecision("sold_kg"),
  soldPcs: doublePrecision("sold_pcs"),
  pricePerKg: doublePrecision("price_per_kg"),
  pricePerPiece: doublePrecision("price_per_piece"),
  totalSalesValue: doublePrecision("total_sales_value"),
  closingKg: doublePrecision("closing_kg"),
  closingPcs: doublePrecision("closing_pcs"),
  remarks: varchar("remarks", { length: 500 }),
  sourceStockLedgerIds: jsonb("source_stock_ledger_ids").$type<number[]>(),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f4_items_sales: index("idx_f4_items_sales").on(t.salesId),
  idx_f4_items_customer: index("idx_f4_items_customer").on(t.customerCode),
  idx_f4_items_invoice: index("idx_f4_items_invoice").on(t.invoiceNo),
}));

// ─── FORM 4: SALES PACKAGING DETAILS ─────────────────────────────────────
export const form4SalesPackaging = pgTable("form4_sales_packaging", {
  id: serial("id").primaryKey(),
  salesItemId: integer("sales_item_id").notNull().references(() => form4SalesItems.id),
  packetSize: varchar("packet_size", { length: 64 }).notNull(),
  numberOfPackets: integer("number_of_packets").notNull(),
  totalQty: doublePrecision("total_qty").notNull(),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f4_packaging_item: index("idx_f4_packaging_item").on(t.salesItemId),
}));
