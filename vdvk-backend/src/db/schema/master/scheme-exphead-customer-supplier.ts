import { boolean, pgTable, text, varchar } from "drizzle-orm/pg-core";

// ─── SCHEMES (versioned names) ────────────────────────────────────────────
export const schemes = pgTable("schemes", {
  code: varchar("code", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  effectiveFrom: varchar("effective_from", { length: 64 }).notNull(),
  effectiveTo: varchar("effective_to", { length: 64 }),
  status: text("status").notNull().default("Active"),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
});

// ─── EXPENDITURE HEADS ───────────────────────────────────────────────────
export const expenditureHeads = pgTable("expenditure_heads", {
  code: varchar("code", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  effectiveFrom: varchar("effective_from", { length: 64 }).notNull(),
  effectiveTo: varchar("effective_to", { length: 64 }),
  excludedFromProcessing: boolean("excluded_from_processing").notNull().default(false),
  status: text("status").notNull().default("Active"),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
});

// ─── CUSTOMERS ───────────────────────────────────────────────────────────
export const customers = pgTable("customers", {
  code: varchar("code", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  mobile: varchar("mobile", { length: 32 }),
  address: varchar("address", { length: 500 }),
  gstNo: varchar("gst_no", { length: 64 }),
  effectiveFrom: varchar("effective_from", { length: 64 }).notNull(),
  effectiveTo: varchar("effective_to", { length: 64 }),
  status: text("status").notNull().default("Active"),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
});

// ─── SUPPLIERS ───────────────────────────────────────────────────────────
export const suppliers = pgTable("suppliers", {
  code: varchar("code", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  contactPerson: varchar("contact_person", { length: 191 }),
  mobile: varchar("mobile", { length: 32 }),
  email: varchar("email", { length: 191 }),
  address: varchar("address", { length: 500 }),
  gstNo: varchar("gst_no", { length: 64 }),
  effectiveFrom: varchar("effective_from", { length: 64 }).notNull(),
  effectiveTo: varchar("effective_to", { length: 64 }),
  status: text("status").notNull().default("Active"),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
});
