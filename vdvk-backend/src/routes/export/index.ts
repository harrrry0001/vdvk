import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { toCSV } from "../../lib/csv.js";
import { stockLedger } from "../../db/schema/shared/stock-ledger.js";
import { auditTrail } from "../../db/schema/shared/audit-notification.js";
import { form1Collections } from "../../db/schema/transaction/form1-collection.js";
import { form2StockTransfers } from "../../db/schema/transaction/form2-stock-transfer.js";
import { form3Processing } from "../../db/schema/transaction/form3-processing.js";
import { form4Sales } from "../../db/schema/transaction/form4-sales.js";
import { form8Utilisation } from "../../db/schema/transaction/form8-utilisation.js";
import { form9Trainings, form10FundUtilisation, form12FieldVisits } from "../../db/schema/transaction/form9-10-12.js";
import { vdvks } from "../../db/schema/master/vdvk-beneficiary.js";
import { beneficiaries } from "../../db/schema/master/vdvk-beneficiary.js";
import { machinery } from "../../db/schema/master/machinery.js";
import { facilities } from "../../db/schema/master/facility.js";
import { requireRole, HonoEnv } from "../../middleware/auth.js";

export const exportRoutes = new Hono<HonoEnv>();

const FORM_TABLES: Record<string, { table: any; name: string }> = {
  "1": { table: form1Collections, name: "form1_collections" },
  "2": { table: form2StockTransfers, name: "form2_stock_transfers" },
  "3": { table: form3Processing, name: "form3_processing" },
  "4": { table: form4Sales, name: "form4_sales" },
  "5": { table: vdvks, name: "vdvks" },
  "6": { table: beneficiaries, name: "beneficiaries" },
  "7": { table: machinery, name: "machinery" },
  "8": { table: form8Utilisation, name: "form8_utilisation" },
  "9": { table: form9Trainings, name: "form9_trainings" },
  "10": { table: form10FundUtilisation, name: "form10_fund_utilisation" },
  "11": { table: facilities, name: "facilities" },
  "12": { table: form12FieldVisits, name: "form12_field_visits" },
};

const BOM = "\uFEFF";

function csvResponse(c: any, filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  return c.body(BOM + toCSV(headers, rows), 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  });
}

function rowsToCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = Object.keys(rows[0]);
  const values = rows.map((r) => headers.map((h) => {
    const v = r[h];
    return v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  }));
  return { headers, rows: values };
}

// ─── STOCK LEDGER EXPORT ─────────────────────────────────────────────────
exportRoutes.get("/stock.csv", async (c) => {
  const { commodityCode, vdvkCode, stockType, facilityCode } = c.req.query();
  const conds = [];
  if (commodityCode) conds.push(eq(stockLedger.commodityCode, commodityCode));
  if (vdvkCode) conds.push(eq(stockLedger.vdvkCode, vdvkCode));
  if (stockType) conds.push(eq(stockLedger.stockType, stockType as any));
  if (facilityCode) conds.push(eq(stockLedger.facilityCode, facilityCode));
  const rows = await db.select().from(stockLedger).where(and(...conds)).orderBy(desc(stockLedger.createdAt)).limit(10000);
  const { headers, rows: values } = rowsToCsv(rows as unknown as Record<string, unknown>[]);
  return csvResponse(c, "stock.csv", headers, values);
});

// ─── AUDIT TRAIL EXPORT (officer/admin only) ─────────────────────────────
exportRoutes.get("/audit.csv", requireRole("PO", "DPM", "MDA"), async (c) => {
  const { transactionId, formType, action } = c.req.query();
  const conds = [];
  if (transactionId) conds.push(eq(auditTrail.transactionId, transactionId));
  if (formType) conds.push(eq(auditTrail.formType, formType as any));
  if (action) conds.push(eq(auditTrail.action, action as any));
  const rows = await db.select().from(auditTrail).where(and(...conds)).orderBy(desc(auditTrail.performedAt)).limit(10000);
  const { headers, rows: values } = rowsToCsv(rows as unknown as Record<string, unknown>[]);
  return csvResponse(c, "audit-trail.csv", headers, values);
});

// ─── FORM LIST EXPORT ────────────────────────────────────────────────────
exportRoutes.get("/forms/:formType", async (c) => {
  const raw = c.req.param("formType");
  const formType = raw.endsWith(".csv") ? raw.slice(0, -4) : raw;
  const f = FORM_TABLES[formType];
  if (!f) return c.json({ error: "Unknown form type" }, 404);
  const rows = await db.select().from(f.table).orderBy(desc(f.table.createdAt)).limit(10000);
  const { headers, rows: values } = rowsToCsv(rows as unknown as Record<string, unknown>[]);
  return csvResponse(c, `${f.name}.csv`, headers, values);
});
