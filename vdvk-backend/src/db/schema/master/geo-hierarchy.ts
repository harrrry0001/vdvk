import { pgTable, text, varchar } from "drizzle-orm/pg-core";

// ─── STATES ──────────────────────────────────────────────────────────────
export const states = pgTable("states", {
  code: varchar("code", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  status: text("status").notNull().default("Active"),
});

// ─── DISTRICTS ───────────────────────────────────────────────────────────
export const districts = pgTable("districts", {
  code: varchar("code", { length: 64 }).primaryKey(),
  stateCode: varchar("state_code", { length: 64 }).notNull().references(() => states.code),
  name: varchar("name", { length: 191 }).notNull(),
  status: text("status").notNull().default("Active"),
});

// ─── MANDALS ─────────────────────────────────────────────────────────────
export const mandals = pgTable("mandals", {
  code: varchar("code", { length: 64 }).primaryKey(),
  districtCode: varchar("district_code", { length: 64 }).notNull().references(() => districts.code),
  name: varchar("name", { length: 191 }).notNull(),
  status: text("status").notNull().default("Active"),
});

// ─── VILLAGES ────────────────────────────────────────────────────────────
export const villages = pgTable("villages", {
  code: varchar("code", { length: 64 }).primaryKey(),
  mandalCode: varchar("mandal_code", { length: 64 }).notNull().references(() => mandals.code),
  name: varchar("name", { length: 191 }).notNull(),
  pinCode: varchar("pin_code", { length: 16 }),
  status: text("status").notNull().default("Active"),
});
