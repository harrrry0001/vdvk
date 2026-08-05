import { Hono } from "hono";
import { db } from "../../db/index.js";
import { vdvks } from "../../db/schema/master/vdvk-beneficiary.js";
import { beneficiaries } from "../../db/schema/master/vdvk-beneficiary.js";
import { commodities } from "../../db/schema/master/commodity-grade-rate.js";
import { facilities } from "../../db/schema/master/facility.js";
import { machinery as machTable } from "../../db/schema/master/machinery.js";
import { form1Collections } from "../../db/schema/transaction/form1-collection.js";
import { form3Processing, form3ProcessingItems } from "../../db/schema/transaction/form3-processing.js";
import { form4Sales } from "../../db/schema/transaction/form4-sales.js";
import { form10ExpenditureItems } from "../../db/schema/transaction/form9-10-12.js";
import { stockLedger } from "../../db/schema/shared/stock-ledger.js";
import { schemes } from "../../db/schema/master/scheme-exphead-customer-supplier.js";
import { form2StockTransfers } from "../../db/schema/transaction/form2-stock-transfer.js";
import { eq, sql, count, sum, and } from "drizzle-orm";
import { requireRole, HonoEnv} from "../../middleware/auth.js";

export const dashboardRoutes = new Hono<HonoEnv>();

// ─── DISTRICT OVERVIEW KPIs ───────────────────────────────────────────────
dashboardRoutes.get("/district-overview", requireRole("PO", "APD", "DPM"), async (c) => {
  const [
    vdvkCount, benefCount, facilityCount,
    form1Approved, form3Approved, form4Approved,
    activeMach, schemesCount,
  ] = await Promise.all([
    db.select({ c: count() }).from(vdvks).where(eq(vdvks.status, "Approved")),
    db.select({ c: count() }).from(beneficiaries).where(eq(beneficiaries.status, "Approved")),
    db.select({ c: count() }).from(facilities).where(eq(facilities.status, "Approved")),
    db.select({ c: count() }).from(form1Collections).where(eq(form1Collections.status, "Approved")),
    db.select({ c: count() }).from(form3Processing).where(eq(form3Processing.status, "Approved")),
    db.select({ c: count() }).from(form4Sales).where(eq(form4Sales.status, "Approved")),
    db.select({ c: count() }).from(machTable).where(eq(machTable.status, "Approved")),
    db.select({ c: count() }).from(schemes).where(eq(schemes.status, "Active")),
  ]);

  // Total stock
  const rawStock = await db.select({ kg: sum(stockLedger.qtyKg), pcs: sum(stockLedger.qtyPieces) }).from(stockLedger).where(and(eq(stockLedger.stockType, "Raw"), eq(stockLedger.isActive, true)));
  const procStock = await db.select({ kg: sum(stockLedger.qtyKg), pcs: sum(stockLedger.qtyPieces) }).from(stockLedger).where(and(eq(stockLedger.stockType, "Processed"), eq(stockLedger.isActive, true)));

  return c.json({
    totalVdvks: vdvkCount[0].c,
    totalBeneficiaries: benefCount[0].c,
    totalFacilities: facilityCount[0].c,
    totalHubs: facilityCount, // TODO: filter by type
    totalMachinery: activeMach[0].c,
    totalSchemes: schemesCount[0].c,
    collectionTransactions: form1Approved[0].c,
    processingTransactions: form3Approved[0].c,
    salesTransactions: form4Approved[0].c,
    rawStockKg: rawStock[0].kg || 0,
    rawStockPcs: rawStock[0].pcs || 0,
    processedStockKg: procStock[0].kg || 0,
    processedStockPcs: procStock[0].pcs || 0,
  });
});

// ─── COMMODITY PERFORMANCE ────────────────────────────────────────────────
dashboardRoutes.get("/commodity-performance", async (c) => {
  // Stock by commodity
  const stockByCommodity = await db
    .select({
      commodityCode: stockLedger.commodityCode,
      commodityName: stockLedger.commodityNameSnapshot,
      totalKg: sum(stockLedger.qtyKg),
      totalPcs: sum(stockLedger.qtyPieces),
      stockType: stockLedger.stockType,
    })
    .from(stockLedger)
    .where(eq(stockLedger.isActive, true))
    .groupBy(stockLedger.commodityCode, stockLedger.commodityNameSnapshot, stockLedger.stockType);

  // Sales by commodity
  const salesStats = await db
    .select({ cnt: count() })
    .from(form4Sales)
    .where(eq(form4Sales.status, "Approved"));

  return c.json({
    stockByCommodity,
    totalSales: salesStats[0].cnt,
  });
});

// ─── VDVK PERFORMANCE RANKING ─────────────────────────────────────────────
dashboardRoutes.get("/vdvk-performance", async (c) => {
  const { mandal, limit = "10", sortBy = "collection" } = c.req.query();

  const vdvkList = await db.select({
    code: vdvks.code, name: vdvks.name, mandal: vdvks.mandal,
    scheme: vdvks.schemeCode, beneficiaryCount: vdvks.beneficiaryCount,
    amountSanctioned: vdvks.amountSanctioned, amountReleased: vdvks.amountReleased,
  }).from(vdvks).where(eq(vdvks.status, "Approved")).limit(Number(limit));

  // For each VDVK, fetch collection/processing/sales counts
  const results = await Promise.all(vdvkList.map(async (v) => {
    const [collCount] = await db.select({ c: count() }).from(form1Collections).where(and(eq(form1Collections.vdvkCode, v.code), eq(form1Collections.status, "Approved")));
    const [procCount] = await db.select({ c: count() })
      .from(form3ProcessingItems)
      .innerJoin(form3Processing, eq(form3Processing.id, form3ProcessingItems.processingId))
      .where(and(eq(form3Processing.status, "Approved"), eq(form3ProcessingItems.vdvkCode, v.code)));
    return { ...v, collectionCount: collCount.c, processingCount: procCount.c };
  }));

  return c.json(results);
});

// ─── FUND MONITORING ──────────────────────────────────────────────────────
dashboardRoutes.get("/fund-monitoring", requireRole("PO", "DPM"), async (c) => {
  const [sanctioned, released, vdvkFunds] = await Promise.all([
    db.select({ total: sum(vdvks.amountSanctioned) }).from(vdvks).where(eq(vdvks.status, "Approved")),
    db.select({ total: sum(vdvks.amountReleased) }).from(vdvks).where(eq(vdvks.status, "Approved")),
    db.select({
      code: vdvks.code, name: vdvks.name, scheme: vdvks.schemeCode,
      sanctioned: vdvks.amountSanctioned, released: vdvks.amountReleased,
    }).from(vdvks).where(eq(vdvks.status, "Approved")),
  ]);

  // Approved expenditure from Form 10
  const [expTotal] = await db.select({ total: sum(form10ExpenditureItems.amount) }).from(form10ExpenditureItems);

  return c.json({
    totalSanctioned: sanctioned[0].total || 0,
    totalReleased: released[0].total || 0,
    totalExpenditure: expTotal.total || 0,
    balance: Number(released[0].total || 0) - Number(expTotal.total || 0),
    vdvkBreakdown: vdvkFunds,
  });
});

// ─── REQUEST MONITORING ───────────────────────────────────────────────────
dashboardRoutes.get("/requests", requireRole("APM", "DPM", "PO"), async (c) => {
  const { status, pendingWith = "APM", page = "1", limit = "20" } = c.req.query();
  const user = c.get("user");

  // Collect requests across forms
  const form1Requests = await db.select({ id: form1Collections.id, txnNo: form1Collections.txnNo, formType: sql`'Form1'`, status: form1Collections.status, createdBy: form1Collections.createdBy, createdAt: form1Collections.createdAt, vdvkCode: form1Collections.vdvkCode }).from(form1Collections).where(status ? eq(form1Collections.status, status as any) : undefined).limit(5);

  const form4Requests = await db.select({ id: form4Sales.id, txnNo: form4Sales.txnNo, formType: sql`'Form4'`, status: form4Sales.status, createdBy: form4Sales.createdBy, createdAt: form4Sales.createdAt }).from(form4Sales).limit(5);

  const form2Requests = await db.select({ id: form2StockTransfers.id, txnNo: form2StockTransfers.txnNo, formType: sql`'Form2'`, status: form2StockTransfers.status, createdBy: form2StockTransfers.createdBy, createdAt: form2StockTransfers.createdAt }).from(form2StockTransfers).limit(5);

  return c.json({
    form1: form1Requests,
    form2: form2Requests,
    form4: form4Requests,
    total: form1Requests.length + form2Requests.length + form4Requests.length,
  });
});

// ─── MACHINERY STATUS SUMMARY ─────────────────────────────────────────────
dashboardRoutes.get("/machinery-summary", async (c) => {
  const statuses = ["Available", "In Use", "Idle", "In Transit", "Under Maintenance", "Out of Service"];
  const results = await Promise.all(statuses.map(async (s) => {
    const [cnt] = await db.select({ c: count() }).from(machTable).where(eq(machTable.currentStatus, s as any));
    return { status: s, count: cnt.c };
  }));
  return c.json(results);
});
