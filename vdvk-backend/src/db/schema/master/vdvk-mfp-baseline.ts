import { real, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { vdvks } from "./vdvk-beneficiary";

// ─── VDVK MFP BASELINE ─────────────────────────────────────────────────────
// Historical "operational status" snapshot per VDVK from the ITDA report
// (`VDVK MFP Detials.xls`, "MFP Collection & Sales Details from the Date of
// Establishment") — activity that predates this MIS. Loaded by
// integration/backend/import-mfp-baseline.libsql.cjs. NOT produced by forms;
// dashboards may show it alongside (not inside) the transactional stock data.
export const vdvkMfpBaseline = sqliteTable("vdvk_mfp_baseline", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // nullable on purpose: unmatched rows are still stored (name kept raw) for review
  vdvkCode: text("vdvk_code").references(() => vdvks.code),
  vdvkNameSnapshot: text("vdvk_name_snapshot").notNull(),
  mandalSnapshot: text("mandal_snapshot"),
  dealingProducts: text("dealing_products"),
  ccName: text("cc_name"),
  ccMobile: text("cc_mobile"),
  // quantity cells are free text ("20000 (500 KGs)", "Adda Leaf") — raw always
  // kept, the numeric column holds the best-effort parse (see parseStatus)
  collectedRaw: text("collected_raw"),
  collectedQty: real("collected_qty"),
  processedRaw: text("processed_raw"),
  processedQty: real("processed_qty"),
  revenue: real("revenue"),
  profit: real("profit"),
  // parsed = plain number | derived = heuristic (KGs-in-parens / "x y = z" / largest)
  // | unparsed = no number at all
  parseStatus: text("parse_status").notNull().default("unparsed"),
  sourceFile: text("source_file"),
  sourceRow: integer("source_row"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
}, (t) => ({
  idx_mfp_baseline_vdvk: index("idx_mfp_baseline_vdvk").on(t.vdvkCode),
  idx_mfp_baseline_mandal: index("idx_mfp_baseline_mandal").on(t.mandalSnapshot),
  uq_mfp_baseline_source: uniqueIndex("uq_mfp_baseline_source").on(t.sourceFile, t.sourceRow),
}));
