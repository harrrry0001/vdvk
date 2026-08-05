import { boolean, doublePrecision, index, integer, jsonb, pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
import { facilities } from "./facility";
import { vdvks } from "./vdvk-beneficiary";
import { suppliers } from "./scheme-exphead-customer-supplier";

// ─── MACHINERY / ASSET REGISTER ──────────────────────────────────────────
export const machinery = pgTable("machinery", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  commodityMapping: jsonb("commodity_mapping").$type<string[]>(),
  currentFacilityCode: varchar("current_facility_code", { length: 64 }).references(() => facilities.code),
  currentVdvkCode: varchar("current_vdvk_code", { length: 64 }).references(() => vdvks.code),
  installationLocation: text("installation_location"),
  mandal: varchar("mandal", { length: 64 }),
  quantity: integer("quantity").notNull().default(1),
  unitCost: doublePrecision("unit_cost").notNull(),
  totalCost: doublePrecision("total_cost").notNull(),
  purchaseDate: varchar("purchase_date", { length: 64 }),
  supplierCode: varchar("supplier_code", { length: 64 }).references(() => suppliers.code),
  supplierNameSnapshot: varchar("supplier_name_snapshot", { length: 191 }),
  supplierContactPerson: varchar("supplier_contact_person", { length: 191 }),
  supplierMobile: varchar("supplier_mobile", { length: 32 }),
  supplierEmail: varchar("supplier_email", { length: 191 }),
  warrantyAvailable: boolean("warranty_available"),
  warrantyType: text("warranty_type"),
  warrantyPeriod: varchar("warranty_period", { length: 64 }),
  warrantyStartDate: varchar("warranty_start_date", { length: 64 }),
  warrantyExpiryDate: varchar("warranty_expiry_date", { length: 64 }),
  fundingSource: varchar("funding_source", { length: 64 }),
  reasonPurpose: varchar("reason_purpose", { length: 500 }),
  currentStatus: text("current_status").notNull().default("Available"),
  lastServiceDate: varchar("last_service_date", { length: 64 }),
  nextServiceDueDate: varchar("next_service_due_date", { length: 64 }),
  source: text("source").notNull().default("Form7"),
  existingAssetId: varchar("existing_asset_id", { length: 64 }),
  // Approval
  status: text("status").notNull().default("Draft"),
  approvalRemarks: varchar("approval_remarks", { length: 500 }),
  approvedBy: varchar("approved_by", { length: 64 }),
  approvedAt: varchar("approved_at", { length: 64 }),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
  updatedAt: varchar("updated_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_machinery_facility: index("idx_machinery_facility").on(t.currentFacilityCode),
  idx_machinery_status: index("idx_machinery_status").on(t.currentStatus),
  idx_machinery_approval: index("idx_machinery_approval").on(t.status),
}));

// ─── MACHINERY TRANSFER RECORDS ──────────────────────────────────────────
export const machineryTransfers = pgTable("machinery_transfers", {
  id: serial("id").primaryKey(),
  machineryId: varchar("machinery_id", { length: 64 }).notNull().references(() => machinery.id),
  transferDate: varchar("transfer_date", { length: 64 }).notNull(),
  fromFacilityCode: varchar("from_facility_code", { length: 64 }),
  toFacilityType: varchar("to_facility_type", { length: 64 }),
  toFacilityCode: varchar("to_facility_code", { length: 64 }),
  reason: varchar("reason", { length: 500 }),
  remarks: varchar("remarks", { length: 500 }),
  supportingDoc: varchar("supporting_doc", { length: 500 }),
  // Completion
  dateReceived: varchar("date_received", { length: 64 }),
  conditionOnArrival: text("condition_on_arrival"),
  completionRemarks: varchar("completion_remarks", { length: 500 }),
  completionPhotos: varchar("completion_photos", { length: 500 }),
  isComplete: boolean("is_complete").notNull().default(false),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_transfers_machinery: index("idx_transfers_machinery").on(t.machineryId),
}));
