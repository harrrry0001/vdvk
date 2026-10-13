import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ─── SCHEMES (versioned names) ────────────────────────────────────────────
export const schemes = sqliteTable("schemes", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  status: text("status").notNull().default("Active"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── EXPENDITURE HEADS ───────────────────────────────────────────────────
export const expenditureHeads = sqliteTable("expenditure_heads", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  excludedFromProcessing: integer("excluded_from_processing", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("Active"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── CUSTOMERS ───────────────────────────────────────────────────────────
export const customers = sqliteTable("customers", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  mobile: text("mobile"),
  address: text("address"),
  gstNo: text("gst_no"),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  status: text("status").notNull().default("Active"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

// ─── SUPPLIERS ───────────────────────────────────────────────────────────
export const suppliers = sqliteTable("suppliers", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  mobile: text("mobile"),
  email: text("email"),
  address: text("address"),
  gstNo: text("gst_no"),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  status: text("status").notNull().default("Active"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});
