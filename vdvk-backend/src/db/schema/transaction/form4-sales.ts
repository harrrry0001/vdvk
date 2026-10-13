import { real, index, integer, text, sqliteTable } from "drizzle-orm/sqlite-core";
import { vdvks } from "../master/vdvk-beneficiary";
import { beneficiaries } from "../master/vdvk-beneficiary";
import { commodities } from "../master/commodity-grade-rate";
import { grades } from "../master/commodity-grade-rate";
import { customers } from "../master/scheme-exphead-customer-supplier";
import { facilities } from "../master/facility";

// ─── FORM 4: SALES (HEADER) ──────────────────────────────────────────────
export const form4Sales = sqliteTable("form4_sales", {
  id: text("id").primaryKey(),
  txnNo: text("txn_no").notNull().unique(),
  saleLocationCode: text("sale_location_code").notNull(),
  saleLocationNameSnapshot: text("sale_location_name_snapshot").notNull(),
  saleDate: text("sale_date").notNull(),
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
  idx_f4_sales_date: index("idx_f4_sales_date").on(t.saleDate),
  idx_f4_sales_status: index("idx_f4_sales_status").on(t.status),
}));

// ─── FORM 4: SALES ITEMS ─────────────────────────────────────────────────
export const form4SalesItems = sqliteTable("form4_sales_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  salesId: text("sales_id").notNull().references(() => form4Sales.id),
  customerCode: text("customer_code").notNull().references(() => customers.code),
  customerNameSnapshot: text("customer_name_snapshot").notNull(),
  customerMobileSnapshot: text("customer_mobile_snapshot"),
  invoiceNo: text("invoice_no").notNull(),
  vdvkCode: text("vdvk_code").notNull().references(() => vdvks.code),
  vdvkNameSnapshot: text("vdvk_name_snapshot").notNull(),
  beneficiaryId: text("beneficiary_id").references(() => beneficiaries.id),
  beneficiaryNameSnapshot: text("beneficiary_name_snapshot"),
  productType: text("product_type").notNull(),
  commodityCode: text("commodity_code").notNull().references(() => commodities.code),
  commodityNameSnapshot: text("commodity_name_snapshot").notNull(),
  gradeCode: text("grade_code").references(() => grades.code),
  gradeNameSnapshot: text("grade_name_snapshot"),
  salesUnit: text("sales_unit").notNull(),
  availableKg: real("available_kg"),
  availablePcs: real("available_pcs"),
  packetDetails: text("packet_details"),
  soldKg: real("sold_kg"),
  soldPcs: real("sold_pcs"),
  pricePerKg: real("price_per_kg"),
  pricePerPiece: real("price_per_piece"),
  totalSalesValue: real("total_sales_value"),
  closingKg: real("closing_kg"),
  closingPcs: real("closing_pcs"),
  remarks: text("remarks"),
  sourceStockLedgerIds: text("source_stock_ledger_ids", { mode: "json" }).$type<number[]>(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f4_items_sales: index("idx_f4_items_sales").on(t.salesId),
  idx_f4_items_customer: index("idx_f4_items_customer").on(t.customerCode),
  idx_f4_items_invoice: index("idx_f4_items_invoice").on(t.invoiceNo),
}));

// ─── FORM 4: SALES PACKAGING DETAILS ─────────────────────────────────────
export const form4SalesPackaging = sqliteTable("form4_sales_packaging", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  salesItemId: integer("sales_item_id").notNull().references(() => form4SalesItems.id),
  packetSize: text("packet_size").notNull(),
  numberOfPackets: integer("number_of_packets").notNull(),
  totalQty: real("total_qty").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f4_packaging_item: index("idx_f4_packaging_item").on(t.salesItemId),
}));
