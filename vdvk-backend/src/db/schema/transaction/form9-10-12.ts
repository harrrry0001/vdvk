import { boolean, doublePrecision, index, integer, jsonb, pgTable, serial, text, varchar } from "drizzle-orm/pg-core";
import { vdvks } from "../master/vdvk-beneficiary";
import { expenditureHeads } from "../master/scheme-exphead-customer-supplier";

// ─── FORM 9: TRAINING PROGRAMME (HEADER) ─────────────────────────────────
export const form9Trainings = pgTable("form9_trainings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  txnNo: varchar("txn_no", { length: 64 }).notNull().unique(),
  trainingDate: varchar("training_date", { length: 64 }).notNull(),
  trainingTitle: varchar("training_title", { length: 191 }).notNull(),
  trainingTopic: text("training_topic"),
  trainingType: text("training_type"),
  trainingVenue: varchar("training_venue", { length: 191 }),
  resourcePerson: varchar("resource_person", { length: 191 }),
  totalParticipants: integer("total_participants"),
  totalExpenditure: doublePrecision("total_expenditure"),
  supportingDocuments: jsonb("supporting_documents").$type<string[]>(),
  overallRemarks: varchar("overall_remarks", { length: 500 }),
  isDraft: boolean("is_draft").notNull().default(false),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
  updatedAt: varchar("updated_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f9_trainings_date: index("idx_f9_trainings_date").on(t.trainingDate),
}));

// ─── FORM 9: TRAINING VDVK ITEMS ─────────────────────────────────────────
export const form9TrainingItems = pgTable("form9_training_items", {
  id: serial("id").primaryKey(),
  trainingId: varchar("training_id", { length: 64 }).notNull().references(() => form9Trainings.id),
  vdvkCode: varchar("vdvk_code", { length: 64 }).notNull().references(() => vdvks.code),
  vdvkNameSnapshot: varchar("vdvk_name_snapshot", { length: 191 }).notNull(),
  schemeSnapshot: varchar("scheme_snapshot", { length: 191 }),
  mandalSnapshot: varchar("mandal_snapshot", { length: 64 }),
  commodityCovered: varchar("commodity_covered", { length: 191 }),
  numberOfParticipants: integer("number_of_participants").notNull(),
  trainingExpense: doublePrecision("training_expense"),
  remarks: varchar("remarks", { length: 500 }),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f9_items_training: index("idx_f9_items_training").on(t.trainingId),
  idx_f9_items_vdvk: index("idx_f9_items_vdvk").on(t.vdvkCode),
}));

// ─── FORM 10: WEEKLY FUND UTILISATION (HEADER) ──────────────────────────
export const form10FundUtilisation = pgTable("form10_fund_utilisation", {
  id: varchar("id", { length: 64 }).primaryKey(),
  txnNo: varchar("txn_no", { length: 64 }).notNull().unique(),
  weekFrom: varchar("week_from", { length: 64 }).notNull(),
  weekTo: varchar("week_to", { length: 64 }).notNull(),
  supportingDocuments: jsonb("supporting_documents").$type<string[]>(),
  overallRemarks: varchar("overall_remarks", { length: 500 }),
  status: text("status").notNull().default("Draft"),
  approvalRemarks: varchar("approval_remarks", { length: 500 }),
  approvedBy: varchar("approved_by", { length: 64 }),
  approvedAt: varchar("approved_at", { length: 64 }),
  submittedAt: varchar("submitted_at", { length: 64 }),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
  updatedAt: varchar("updated_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f10_funds_week: index("idx_f10_funds_week").on(t.weekFrom, t.weekTo),
  idx_f10_funds_status: index("idx_f10_funds_status").on(t.status),
}));

// ─── FORM 10: EXPENDITURE ITEMS ──────────────────────────────────────────
export const form10ExpenditureItems = pgTable("form10_expenditure_items", {
  id: serial("id").primaryKey(),
  utilisationId: varchar("utilisation_id", { length: 64 }).notNull().references(() => form10FundUtilisation.id),
  expenditureDate: varchar("expenditure_date", { length: 64 }).notNull(),
  expenditureHeadCode: varchar("expenditure_head_code", { length: 64 }).notNull().references(() => expenditureHeads.code),
  expenditureHeadNameSnapshot: varchar("expenditure_head_name_snapshot", { length: 191 }).notNull(),
  relatedToVdvk: boolean("related_to_vdvk").notNull(),
  vdvkCodes: jsonb("vdvk_codes").$type<string[]>(),
  relatedToLocation: boolean("related_to_location").notNull(),
  locationType: text("location_type"),
  locationCodes: jsonb("location_codes").$type<string[]>(),
  amount: doublePrecision("amount").notNull(),
  purpose: varchar("purpose", { length: 500 }),
  schemeSnapshot: varchar("scheme_snapshot", { length: 191 }),
  remarks: varchar("remarks", { length: 500 }),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f10_items_utilisation: index("idx_f10_items_utilisation").on(t.utilisationId),
  idx_f10_items_head: index("idx_f10_items_head").on(t.expenditureHeadCode),
}));

// ─── FORM 12: FIELD VISIT REGISTER ──────────────────────────────────────
export const form12FieldVisits = pgTable("form12_field_visits", {
  id: varchar("id", { length: 64 }).primaryKey(),
  txnNo: varchar("txn_no", { length: 64 }).notNull().unique(),
  visitDate: varchar("visit_date", { length: 64 }).notNull(),
  visitStartTime: varchar("visit_start_time", { length: 32 }).notNull(),
  visitEndTime: varchar("visit_end_time", { length: 32 }),
  mandal: varchar("mandal", { length: 64 }).notNull(),
  visitLocationType: text("visit_location_type").notNull(),
  locationName: varchar("location_name", { length: 191 }),
  relatedVdvkCodes: jsonb("related_vdvk_codes").$type<string[]>(),
  purposeOfVisit: text("purpose_of_visit"),
  visitDescription: varchar("visit_description", { length: 500 }),
  keyObservations: varchar("key_observations", { length: 500 }),
  gpsLatitude: doublePrecision("gps_latitude"),
  gpsLongitude: doublePrecision("gps_longitude"),
  photoCount: integer("photo_count").notNull().default(0),
  supportingDocuments: jsonb("supporting_documents").$type<string[]>(),
  remarks: varchar("remarks", { length: 500 }),
  editableUntil: varchar("editable_until", { length: 64 }).notNull(),
  createdBy: varchar("created_by", { length: 64 }).notNull(),
  createdByRoleSnapshot: varchar("created_by_role_snapshot", { length: 64 }).notNull(),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
  updatedAt: varchar("updated_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f12_visits_date: index("idx_f12_visits_date").on(t.visitDate),
  idx_f12_visits_mandal: index("idx_f12_visits_mandal").on(t.mandal),
  idx_f12_visits_created: index("idx_f12_visits_created").on(t.createdBy),
}));

// ─── FORM 12: VISIT PHOTOGRAPHS ──────────────────────────────────────────
export const form12VisitPhotos = pgTable("form12_visit_photos", {
  id: serial("id").primaryKey(),
  visitId: varchar("visit_id", { length: 64 }).notNull().references(() => form12FieldVisits.id),
  photoUrl: varchar("photo_url", { length: 500 }).notNull(),
  gpsLatitude: doublePrecision("gps_latitude"),
  gpsLongitude: doublePrecision("gps_longitude"),
  capturedAt: varchar("captured_at", { length: 64 }),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_f12_photos_visit: index("idx_f12_photos_visit").on(t.visitId),
}));
