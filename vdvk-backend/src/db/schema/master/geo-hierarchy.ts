import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// ─── STATES ──────────────────────────────────────────────────────────────
export const states = sqliteTable("states", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
});

// ─── DISTRICTS ───────────────────────────────────────────────────────────
export const districts = sqliteTable("districts", {
  code: text("code").primaryKey(),
  stateCode: text("state_code").notNull().references(() => states.code),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
});

// ─── MANDALS ─────────────────────────────────────────────────────────────
export const mandals = sqliteTable("mandals", {
  code: text("code").primaryKey(),
  districtCode: text("district_code").notNull().references(() => districts.code),
  name: text("name").notNull(),
  status: text("status").notNull().default("Active"),
});

// ─── VILLAGES ────────────────────────────────────────────────────────────
export const villages = sqliteTable("villages", {
  code: text("code").primaryKey(),
  mandalCode: text("mandal_code").notNull().references(() => mandals.code),
  name: text("name").notNull(),
  pinCode: text("pin_code"),
  status: text("status").notNull().default("Active"),
});
