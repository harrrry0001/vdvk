import { real, index, sqliteTable, integer, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── COMMODITIES (versioned unit-of-measure) ──────────────────────────────
export const commodities = sqliteTable("commodities", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  defaultUnit: text("default_unit").notNull(),
  unitEffectiveFrom: text("unit_effective_from").notNull(),
  unitEffectiveTo: text("unit_effective_to"),
  status: text("status").notNull().default("Active"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_commodities_status: index("idx_commodities_status").on(t.status),
  idx_commodities_dates: index("idx_commodities_dates").on(t.unitEffectiveFrom, t.unitEffectiveTo),
}));

// ─── GRADES (per-commodity, versioned) ───────────────────────────────────
export const grades = sqliteTable("grades", {
  code: text("code").primaryKey(),
  commodityCode: text("commodity_code").notNull().references(() => commodities.code),
  gradeName: text("grade_name").notNull(),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  status: text("status").notNull().default("Active"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_grades_commodity: index("idx_grades_commodity").on(t.commodityCode),
  idx_grades_dates: index("idx_grades_dates").on(t.effectiveFrom, t.effectiveTo),
}));

// ─── COMMODITY RATES (versioned with effective dates) ─────────────────────
export const commodityRates = sqliteTable("commodity_rates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  commodityCode: text("commodity_code").notNull().references(() => commodities.code),
  gradeCode: text("grade_code").notNull().references(() => grades.code),
  unit: text("unit").notNull(),
  ratePerKg: real("rate_per_kg"),
  ratePerPiece: real("rate_per_piece"),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_rates_commodity: index("idx_rates_commodity").on(t.commodityCode),
  idx_rates_dates: index("idx_rates_dates").on(t.effectiveFrom, t.effectiveTo),
  // Partial unique index — exactly one open (effective_to IS NULL) rate per
  // commodity+grade, mirroring the original SQLite design.
  uq_rate_active: uniqueIndex("uq_rate_active")
    .on(t.commodityCode, t.gradeCode)
    .where(sql`effective_to IS NULL`),
}));
