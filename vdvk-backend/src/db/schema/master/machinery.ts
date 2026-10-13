import { integer, real, index, text, sqliteTable } from "drizzle-orm/sqlite-core";
import { facilities } from "./facility";
import { vdvks } from "./vdvk-beneficiary";
import { suppliers } from "./scheme-exphead-customer-supplier";

// ─── MACHINERY / ASSET REGISTER ──────────────────────────────────────────
export const machinery = sqliteTable("machinery", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  commodityMapping: text("commodity_mapping", { mode: "json" }).$type<string[]>(),
  currentFacilityCode: text("current_facility_code").references(() => facilities.code),
  currentVdvkCode: text("current_vdvk_code").references(() => vdvks.code),
  installationLocation: text("installation_location"),
  mandal: text("mandal"),
  quantity: integer("quantity").notNull().default(1),
  unitCost: real("unit_cost").notNull(),
  totalCost: real("total_cost").notNull(),
  purchaseDate: text("purchase_date"),
  supplierCode: text("supplier_code").references(() => suppliers.code),
  supplierNameSnapshot: text("supplier_name_snapshot"),
  supplierContactPerson: text("supplier_contact_person"),
  supplierMobile: text("supplier_mobile"),
  supplierEmail: text("supplier_email"),
  warrantyAvailable: integer("warranty_available", { mode: "boolean" }),
  warrantyType: text("warranty_type"),
  warrantyPeriod: text("warranty_period"),
  warrantyStartDate: text("warranty_start_date"),
  warrantyExpiryDate: text("warranty_expiry_date"),
  fundingSource: text("funding_source"),
  reasonPurpose: text("reason_purpose"),
  currentStatus: text("current_status").notNull().default("Available"),
  lastServiceDate: text("last_service_date"),
  nextServiceDueDate: text("next_service_due_date"),
  source: text("source").notNull().default("Form7"),
  existingAssetId: text("existing_asset_id"),
  // Approval
  status: text("status").notNull().default("Draft"),
  approvalRemarks: text("approval_remarks"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_machinery_facility: index("idx_machinery_facility").on(t.currentFacilityCode),
  idx_machinery_status: index("idx_machinery_status").on(t.currentStatus),
  idx_machinery_approval: index("idx_machinery_approval").on(t.status),
}));

// ─── MACHINERY TRANSFER RECORDS ──────────────────────────────────────────
export const machineryTransfers = sqliteTable("machinery_transfers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  machineryId: text("machinery_id").notNull().references(() => machinery.id),
  transferDate: text("transfer_date").notNull(),
  fromFacilityCode: text("from_facility_code"),
  toFacilityType: text("to_facility_type"),
  toFacilityCode: text("to_facility_code"),
  reason: text("reason"),
  remarks: text("remarks"),
  supportingDoc: text("supporting_doc"),
  // Completion
  dateReceived: text("date_received"),
  conditionOnArrival: text("condition_on_arrival"),
  completionRemarks: text("completion_remarks"),
  completionPhotos: text("completion_photos"),
  isComplete: integer("is_complete", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_transfers_machinery: index("idx_transfers_machinery").on(t.machineryId),
}));
