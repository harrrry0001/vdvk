import { boolean, index, integer, jsonb, pgTable, serial, text, varchar } from "drizzle-orm/pg-core";

// ─── AUDIT TRAIL ──────────────────────────────────────────────────────────
export const auditTrail = pgTable("audit_trail", {
  id: varchar("id", { length: 64 }).primaryKey(),
  transactionId: varchar("transaction_id", { length: 500 }).notNull(),
  formType: text("form_type").notNull(),
  action: text("action").notNull(),
  performedBy: varchar("performed_by", { length: 64 }),
  performerRoleSnapshot: varchar("performer_role_snapshot", { length: 64 }),
  performedAt: varchar("performed_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
  oldValues: jsonb("old_values"),
  newValues: jsonb("new_values"),
  remarks: varchar("remarks", { length: 500 }),
  escalated: boolean("escalated").notNull().default(false),
  escalatedTo: varchar("escalated_to", { length: 64 }),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_audit_txn: index("idx_audit_txn").on(t.transactionId),
  idx_audit_form_type: index("idx_audit_form_type").on(t.formType),
  idx_audit_action: index("idx_audit_action").on(t.action),
  idx_audit_performed_by: index("idx_audit_performed_by").on(t.performedBy),
  idx_audit_at: index("idx_audit_at").on(t.performedAt),
}));

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: varchar("id", { length: 64 }).primaryKey(),
  recipientUserId: varchar("recipient_user_id", { length: 64 }).notNull(),
  type: text("type").notNull(),
  title: varchar("title", { length: 191 }).notNull(),
  body: varchar("body", { length: 500 }).notNull(),
  relatedTransactionId: varchar("related_transaction_id", { length: 500 }),
  isRead: boolean("is_read").notNull().default(false),
  readAt: varchar("read_at", { length: 64 }),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_notif_user: index("idx_notif_user").on(t.recipientUserId),
  idx_notif_read: index("idx_notif_read").on(t.isRead),
  idx_notif_created: index("idx_notif_created").on(t.createdAt),
}));

// ─── NOTIFICATION LOG (APPEND-ONLY) ──────────────────────────────────────
export const notificationLog = pgTable("notification_log", {
  id: serial("id").primaryKey(),
  notificationId: varchar("notification_id", { length: 64 }),
  channel: text("channel").notNull(),
  recipientEmail: varchar("recipient_email", { length: 191 }),
  sentAt: varchar("sent_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
  status: text("status").notNull().default("SENT"),
  errorMessage: varchar("error_message", { length: 500 }),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_notif_log_notif: index("idx_notif_log_notif").on(t.notificationId),
}));

// ─── REJECTED RECORDS TABLE ──────────────────────────────────────────────
export const rejectedRecords = pgTable("rejected_records", {
  id: serial("id").primaryKey(),
  originalTransactionId: varchar("original_transaction_id", { length: 500 }).notNull(),
  formType: text("form_type").notNull(),
  rejectedData: jsonb("rejected_data").notNull(),
  rejectedBy: varchar("rejected_by", { length: 64 }),
  rejectionRemarks: varchar("rejection_remarks", { length: 500 }),
  rejectedAt: varchar("rejected_at", { length: 64 }),
  resubmittedAs: varchar("resubmitted_as", { length: 64 }),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_rejected_txn: index("idx_rejected_txn").on(t.originalTransactionId),
  idx_rejected_form: index("idx_rejected_form").on(t.formType),
}));

// ─── EMAIL TEMPLATES ─────────────────────────────────────────────────────
export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  templateKey: varchar("template_key", { length: 64 }).notNull().unique(),
  subject: varchar("subject", { length: 191 }).notNull(),
  bodyHtml: varchar("body_html", { length: 1000 }).notNull(),
  updatedAt: varchar("updated_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
});

// ─── SYSTEM CONFIGURATION ────────────────────────────────────────────────
export const systemConfig = pgTable("system_config", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: varchar("value", { length: 500 }).notNull(),
  description: varchar("description", { length: 500 }),
  updatedAt: varchar("updated_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
});

// ─── MIGRATION LOG ───────────────────────────────────────────────────────
export const migrationLog = pgTable("migration_log", {
  id: serial("id").primaryKey(),
  entity: varchar("entity", { length: 64 }).notNull(),
  recordCount: integer("record_count").notNull(),
  migratedBy: varchar("migrated_by", { length: 64 }).notNull(),
  sourceFile: varchar("source_file", { length: 500 }),
  remarks: varchar("remarks", { length: 500 }),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
});
