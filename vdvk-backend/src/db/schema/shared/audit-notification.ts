import { integer, index, text, sqliteTable } from "drizzle-orm/sqlite-core";

// ─── AUDIT TRAIL ──────────────────────────────────────────────────────────
export const auditTrail = sqliteTable("audit_trail", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id").notNull(),
  formType: text("form_type").notNull(),
  action: text("action").notNull(),
  performedBy: text("performed_by"),
  performerRoleSnapshot: text("performer_role_snapshot"),
  performedAt: text("performed_at").$defaultFn(() => new Date().toISOString()),
  oldValues: text("old_values", { mode: "json" }),
  newValues: text("new_values", { mode: "json" }),
  remarks: text("remarks"),
  escalated: integer("escalated", { mode: "boolean" }).notNull().default(false),
  escalatedTo: text("escalated_to"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_audit_txn: index("idx_audit_txn").on(t.transactionId),
  idx_audit_form_type: index("idx_audit_form_type").on(t.formType),
  idx_audit_action: index("idx_audit_action").on(t.action),
  idx_audit_performed_by: index("idx_audit_performed_by").on(t.performedBy),
  idx_audit_at: index("idx_audit_at").on(t.performedAt),
}));

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  recipientUserId: text("recipient_user_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  relatedTransactionId: text("related_transaction_id"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  readAt: text("read_at"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_notif_user: index("idx_notif_user").on(t.recipientUserId),
  idx_notif_read: index("idx_notif_read").on(t.isRead),
  idx_notif_created: index("idx_notif_created").on(t.createdAt),
}));

// ─── NOTIFICATION LOG (APPEND-ONLY) ──────────────────────────────────────
export const notificationLog = sqliteTable("notification_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  notificationId: text("notification_id"),
  channel: text("channel").notNull(),
  recipientEmail: text("recipient_email"),
  sentAt: text("sent_at").$defaultFn(() => new Date().toISOString()),
  status: text("status").notNull().default("SENT"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_notif_log_notif: index("idx_notif_log_notif").on(t.notificationId),
}));

// ─── REJECTED RECORDS TABLE ──────────────────────────────────────────────
export const rejectedRecords = sqliteTable("rejected_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  originalTransactionId: text("original_transaction_id").notNull(),
  formType: text("form_type").notNull(),
  rejectedData: text("rejected_data", { mode: "json" }).notNull(),
  rejectedBy: text("rejected_by"),
  rejectionRemarks: text("rejection_remarks"),
  rejectedAt: text("rejected_at"),
  resubmittedAs: text("resubmitted_as"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_rejected_txn: index("idx_rejected_txn").on(t.originalTransactionId),
  idx_rejected_form: index("idx_rejected_form").on(t.formType),
}));

// ─── EMAIL TEMPLATES ─────────────────────────────────────────────────────
export const emailTemplates = sqliteTable("email_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  templateKey: text("template_key").notNull().unique(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── SYSTEM CONFIGURATION ────────────────────────────────────────────────
export const systemConfig = sqliteTable("system_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

// ─── MIGRATION LOG ───────────────────────────────────────────────────────
export const migrationLog = sqliteTable("migration_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entity: text("entity").notNull(),
  recordCount: integer("record_count").notNull(),
  migratedBy: text("migrated_by").notNull(),
  sourceFile: text("source_file"),
  remarks: text("remarks"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});
