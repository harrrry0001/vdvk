import { integer, real, index, text, sqliteTable } from "drizzle-orm/sqlite-core";
import { vdvks } from "../master/vdvk-beneficiary";
import { expenditureHeads } from "../master/scheme-exphead-customer-supplier";

// ─── FORM 9: TRAINING PROGRAMME (HEADER) ─────────────────────────────────
export const form9Trainings = sqliteTable("form9_trainings", {
  id: text("id").primaryKey(),
  txnNo: text("txn_no").notNull().unique(),
  trainingDate: text("training_date").notNull(),
  trainingTitle: text("training_title").notNull(),
  trainingTopic: text("training_topic"),
  trainingType: text("training_type"),
  trainingVenue: text("training_venue"),
  resourcePerson: text("resource_person"),
  totalParticipants: integer("total_participants"),
  totalExpenditure: real("total_expenditure"),
  supportingDocuments: text("supporting_documents", { mode: "json" }).$type<string[]>(),
  overallRemarks: text("overall_remarks"),
  isDraft: integer("is_draft", { mode: "boolean" }).notNull().default(false),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f9_trainings_date: index("idx_f9_trainings_date").on(t.trainingDate),
}));

// ─── FORM 9: TRAINING VDVK ITEMS ─────────────────────────────────────────
export const form9TrainingItems = sqliteTable("form9_training_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trainingId: text("training_id").notNull().references(() => form9Trainings.id),
  vdvkCode: text("vdvk_code").notNull().references(() => vdvks.code),
  vdvkNameSnapshot: text("vdvk_name_snapshot").notNull(),
  schemeSnapshot: text("scheme_snapshot"),
  mandalSnapshot: text("mandal_snapshot"),
  commodityCovered: text("commodity_covered"),
  numberOfParticipants: integer("number_of_participants").notNull(),
  trainingExpense: real("training_expense"),
  remarks: text("remarks"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f9_items_training: index("idx_f9_items_training").on(t.trainingId),
  idx_f9_items_vdvk: index("idx_f9_items_vdvk").on(t.vdvkCode),
}));

// ─── FORM 10: WEEKLY FUND UTILISATION (HEADER) ──────────────────────────
export const form10FundUtilisation = sqliteTable("form10_fund_utilisation", {
  id: text("id").primaryKey(),
  txnNo: text("txn_no").notNull().unique(),
  weekFrom: text("week_from").notNull(),
  weekTo: text("week_to").notNull(),
  supportingDocuments: text("supporting_documents", { mode: "json" }).$type<string[]>(),
  overallRemarks: text("overall_remarks"),
  status: text("status").notNull().default("Draft"),
  approvalRemarks: text("approval_remarks"),
  approvedBy: text("approved_by"),
  approvedAt: text("approved_at"),
  submittedAt: text("submitted_at"),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f10_funds_week: index("idx_f10_funds_week").on(t.weekFrom, t.weekTo),
  idx_f10_funds_status: index("idx_f10_funds_status").on(t.status),
}));

// ─── FORM 10: EXPENDITURE ITEMS ──────────────────────────────────────────
export const form10ExpenditureItems = sqliteTable("form10_expenditure_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  utilisationId: text("utilisation_id").notNull().references(() => form10FundUtilisation.id),
  expenditureDate: text("expenditure_date").notNull(),
  expenditureHeadCode: text("expenditure_head_code").notNull().references(() => expenditureHeads.code),
  expenditureHeadNameSnapshot: text("expenditure_head_name_snapshot").notNull(),
  relatedToVdvk: integer("related_to_vdvk", { mode: "boolean" }).notNull(),
  vdvkCodes: text("vdvk_codes", { mode: "json" }).$type<string[]>(),
  relatedToLocation: integer("related_to_location", { mode: "boolean" }).notNull(),
  locationType: text("location_type"),
  locationCodes: text("location_codes", { mode: "json" }).$type<string[]>(),
  amount: real("amount").notNull(),
  purpose: text("purpose"),
  schemeSnapshot: text("scheme_snapshot"),
  remarks: text("remarks"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f10_items_utilisation: index("idx_f10_items_utilisation").on(t.utilisationId),
  idx_f10_items_head: index("idx_f10_items_head").on(t.expenditureHeadCode),
}));

// ─── FORM 12: FIELD VISIT REGISTER ──────────────────────────────────────
export const form12FieldVisits = sqliteTable("form12_field_visits", {
  id: text("id").primaryKey(),
  txnNo: text("txn_no").notNull().unique(),
  visitDate: text("visit_date").notNull(),
  visitStartTime: text("visit_start_time").notNull(),
  visitEndTime: text("visit_end_time"),
  mandal: text("mandal").notNull(),
  visitLocationType: text("visit_location_type").notNull(),
  locationName: text("location_name"),
  relatedVdvkCodes: text("related_vdvk_codes", { mode: "json" }).$type<string[]>(),
  purposeOfVisit: text("purpose_of_visit"),
  visitDescription: text("visit_description"),
  keyObservations: text("key_observations"),
  gpsLatitude: real("gps_latitude"),
  gpsLongitude: real("gps_longitude"),
  photoCount: integer("photo_count").notNull().default(0),
  supportingDocuments: text("supporting_documents", { mode: "json" }).$type<string[]>(),
  remarks: text("remarks"),
  editableUntil: text("editable_until").notNull(),
  createdBy: text("created_by").notNull(),
  createdByRoleSnapshot: text("created_by_role_snapshot").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f12_visits_date: index("idx_f12_visits_date").on(t.visitDate),
  idx_f12_visits_mandal: index("idx_f12_visits_mandal").on(t.mandal),
  idx_f12_visits_created: index("idx_f12_visits_created").on(t.createdBy),
}));

// ─── FORM 12: VISIT PHOTOGRAPHS ──────────────────────────────────────────
export const form12VisitPhotos = sqliteTable("form12_visit_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  visitId: text("visit_id").notNull().references(() => form12FieldVisits.id),
  photoUrl: text("photo_url").notNull(),
  gpsLatitude: real("gps_latitude"),
  gpsLongitude: real("gps_longitude"),
  capturedAt: text("captured_at"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f12_photos_visit: index("idx_f12_photos_visit").on(t.visitId),
}));
