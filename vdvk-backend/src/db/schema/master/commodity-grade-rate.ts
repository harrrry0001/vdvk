import { doublePrecision, index, pgTable, serial, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── COMMODITIES (versioned unit-of-measure) ──────────────────────────────
export const commodities = pgTable("commodities", {
  code: varchar("code", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 191 }).notNull(),
  defaultUnit: text("default_unit").notNull(),
  unitEffectiveFrom: varchar("unit_effective_from", { length: 64 }).notNull(),
  unitEffectiveTo: varchar("unit_effective_to", { length: 64 }),
  status: text("status").notNull().default("Active"),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
  updatedAt: varchar("updated_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_commodities_status: index("idx_commodities_status").on(t.status),
  idx_commodities_dates: index("idx_commodities_dates").on(t.unitEffectiveFrom, t.unitEffectiveTo),
}));

// ─── GRADES (per-commodity, versioned) ───────────────────────────────────
export const grades = pgTable("grades", {
  code: varchar("code", { length: 64 }).primaryKey(),
  commodityCode: varchar("commodity_code", { length: 64 }).notNull().references(() => commodities.code),
  gradeName: varchar("grade_name", { length: 191 }).notNull(),
  effectiveFrom: varchar("effective_from", { length: 64 }).notNull(),
  effectiveTo: varchar("effective_to", { length: 64 }),
  status: text("status").notNull().default("Active"),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_grades_commodity: index("idx_grades_commodity").on(t.commodityCode),
  idx_grades_dates: index("idx_grades_dates").on(t.effectiveFrom, t.effectiveTo),
}));

// ─── COMMODITY RATES (versioned with effective dates) ─────────────────────
export const commodityRates = pgTable("commodity_rates", {
  id: serial("id").primaryKey(),
  commodityCode: varchar("commodity_code", { length: 64 }).notNull().references(() => commodities.code),
  gradeCode: varchar("grade_code", { length: 64 }).notNull().references(() => grades.code),
  unit: text("unit").notNull(),
  ratePerKg: doublePrecision("rate_per_kg"),
  ratePerPiece: doublePrecision("rate_per_piece"),
  effectiveFrom: varchar("effective_from", { length: 64 }).notNull(),
  effectiveTo: varchar("effective_to", { length: 64 }),
  createdAt: varchar("created_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
  updatedAt: varchar("updated_at", { length: 64 }).$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_rates_commodity: index("idx_rates_commodity").on(t.commodityCode),
  idx_rates_dates: index("idx_rates_dates").on(t.effectiveFrom, t.effectiveTo),
  // Partial unique index — exactly one open (effective_to IS NULL) rate per
  // commodity+grade, mirroring the original SQLite design.
  uq_rate_active: uniqueIndex("uq_rate_active")
    .on(t.commodityCode, t.gradeCode)
    .where(sql`effective_to IS NULL`),
}));
