import { Hono } from "hono";
import { db } from "../../db/index.js";
import { vdvks } from "../../db/schema/master/vdvk-beneficiary.js";
import { beneficiaries } from "../../db/schema/master/vdvk-beneficiary.js";
import { commodities } from "../../db/schema/master/commodity-grade-rate.js";
import { facilities, facilityVdvkMapping } from "../../db/schema/master/facility.js";
import { machinery as machTable } from "../../db/schema/master/machinery.js";
import { form1Collections, form1CollectionItems } from "../../db/schema/transaction/form1-collection.js";
import { form3Processing, form3ProcessingItems } from "../../db/schema/transaction/form3-processing.js";
import { form4Sales, form4SalesItems } from "../../db/schema/transaction/form4-sales.js";
import { form10ExpenditureItems, form10FundUtilisation } from "../../db/schema/transaction/form9-10-12.js";
import { stockLedger } from "../../db/schema/shared/stock-ledger.js";
import { schemes } from "../../db/schema/master/scheme-exphead-customer-supplier.js";
import { form2StockTransfers } from "../../db/schema/transaction/form2-stock-transfer.js";
import { form8Utilisation } from "../../db/schema/transaction/form8-utilisation.js";
import { users } from "../../db/schema/master/user.js";
import { eq, count, sum, and, gte, lte } from "drizzle-orm";
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
  const { mandal, limit = "10", sortBy = "collection", from, to } = c.req.query();

  const vdvkList = await db.select({
    code: vdvks.code, name: vdvks.name, mandal: vdvks.mandal,
    scheme: vdvks.schemeCode, beneficiaryCount: vdvks.beneficiaryCount,
    amountSanctioned: vdvks.amountSanctioned, amountReleased: vdvks.amountReleased,
  }).from(vdvks).where(eq(vdvks.status, "Approved")).limit(Number(limit));

  // Sales revenue + sold qty by VDVK (approved Form 4)
  const salesConds = [eq(form4Sales.status, "Approved")];
  if (from) salesConds.push(gte(form4Sales.saleDate, from));
  if (to) salesConds.push(lte(form4Sales.saleDate, to));
  const salesRows = await db
    .select({
      vdvkCode: form4SalesItems.vdvkCode,
      revenue: sum(form4SalesItems.totalSalesValue),
      kg: sum(form4SalesItems.soldKg),
      pcs: sum(form4SalesItems.soldPcs),
    })
    .from(form4SalesItems)
    .innerJoin(form4Sales, eq(form4Sales.id, form4SalesItems.salesId))
    .where(and(...salesConds))
    .groupBy(form4SalesItems.vdvkCode);
  const salesByVdvk: Record<string, { revenue: number; kg: number; pcs: number }> = {};
  salesRows.forEach((r) => {
    salesByVdvk[r.vdvkCode] = {
      revenue: Number(r.revenue || 0),
      kg: Number(r.kg || 0),
      pcs: Number(r.pcs || 0),
    };
  });

  // For each VDVK, fetch collection/processing counts (with optional date filter)
  const results = await Promise.all(vdvkList.map(async (v) => {
    const collConds = [eq(form1Collections.vdvkCode, v.code), eq(form1Collections.status, "Approved")];
    if (from) collConds.push(gte(form1Collections.collectionDate, from));
    if (to) collConds.push(lte(form1Collections.collectionDate, to));
    const [collCount] = await db.select({ c: count() }).from(form1Collections).where(and(...collConds));

    const procConds = [eq(form3Processing.status, "Approved"), eq(form3ProcessingItems.vdvkCode, v.code)];
    if (from) procConds.push(gte(form3Processing.processingDate, from));
    if (to) procConds.push(lte(form3Processing.processingDate, to));
    const [procCount] = await db.select({ c: count() })
      .from(form3ProcessingItems)
      .innerJoin(form3Processing, eq(form3Processing.id, form3ProcessingItems.processingId))
      .where(and(...procConds));

    const s = salesByVdvk[v.code] || { revenue: 0, kg: 0, pcs: 0 };
    return { ...v, collectionCount: collCount.c, processingCount: procCount.c, revenue: s.revenue, salesKg: s.kg, salesPcs: s.pcs };
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

  // Sales revenue from approved Form 4 (items carry the vdvk_code + total value)
  const revenueRows = await db
    .select({
      vdvkCode: form4SalesItems.vdvkCode,
      total: sum(form4SalesItems.totalSalesValue),
    })
    .from(form4SalesItems)
    .innerJoin(form4Sales, eq(form4Sales.id, form4SalesItems.salesId))
    .where(eq(form4Sales.status, "Approved"))
    .groupBy(form4SalesItems.vdvkCode);
  const revenueByVdvk: Record<string, number> = {};
  let totalRevenue = 0;
  revenueRows.forEach((r) => {
    const v = Number(r.total || 0);
    revenueByVdvk[r.vdvkCode] = (revenueByVdvk[r.vdvkCode] || 0) + v;
    totalRevenue += v;
  });

  // MFP collection qty from approved Form 1 (header carries vdvk_code)
  const collectionRows = await db
    .select({
      vdvkCode: form1Collections.vdvkCode,
      totalKg: sum(form1CollectionItems.qtyKg),
      totalPcs: sum(form1CollectionItems.qtyPieces),
    })
    .from(form1CollectionItems)
    .innerJoin(form1Collections, eq(form1Collections.id, form1CollectionItems.collectionId))
    .where(eq(form1Collections.status, "Approved"))
    .groupBy(form1Collections.vdvkCode);
  const collectionByVdvk: Record<string, number> = {};
  let totalCollectionKg = 0;
  let totalCollectionPcs = 0;
  collectionRows.forEach((r) => {
    const kg = Number(r.totalKg || 0);
    const pcs = Number(r.totalPcs || 0);
    collectionByVdvk[r.vdvkCode] = (collectionByVdvk[r.vdvkCode] || 0) + kg;
    totalCollectionKg += kg;
    totalCollectionPcs += pcs;
  });

  // Processing qty from approved Form 3 (items carry vdvk_code)
  const processingRows = await db
    .select({
      vdvkCode: form3ProcessingItems.vdvkCode,
      totalKg: sum(form3ProcessingItems.qtyTakenKg),
      totalPcs: sum(form3ProcessingItems.qtyTakenPcs),
    })
    .from(form3ProcessingItems)
    .innerJoin(form3Processing, eq(form3Processing.id, form3ProcessingItems.processingId))
    .where(eq(form3Processing.status, "Approved"))
    .groupBy(form3ProcessingItems.vdvkCode);
  const processingByVdvk: Record<string, number> = {};
  let totalProcessingKg = 0;
  let totalProcessingPcs = 0;
  processingRows.forEach((r) => {
    const kg = Number(r.totalKg || 0);
    const pcs = Number(r.totalPcs || 0);
    processingByVdvk[r.vdvkCode] = (processingByVdvk[r.vdvkCode] || 0) + kg;
    totalProcessingKg += kg;
    totalProcessingPcs += pcs;
  });

  // Fund utilisation by VDVK from approved Form 10 (vdvkCodes jsonb array)
  const utilRows = await db
    .select({
      vdvkCodes: form10ExpenditureItems.vdvkCodes,
      amount: form10ExpenditureItems.amount,
    })
    .from(form10ExpenditureItems)
    .innerJoin(form10FundUtilisation, eq(form10FundUtilisation.id, form10ExpenditureItems.utilisationId))
    .where(eq(form10FundUtilisation.status, "Approved"));
  const utilisedByVdvk: Record<string, number> = {};
  let totalUtilised = 0;
  utilRows.forEach((r) => {
    const amt = Number(r.amount || 0);
    if (!Array.isArray(r.vdvkCodes) || r.vdvkCodes.length === 0) return;
    r.vdvkCodes.forEach((code) => {
      utilisedByVdvk[code] = (utilisedByVdvk[code] || 0) + amt;
    });
    totalUtilised += amt;
  });

  const vdvkBreakdown = vdvkFunds.map((v) => {
    const utilised = utilisedByVdvk[v.code] || 0;
    const released = Number(v.released || 0);
    return {
      ...v,
      collectionKg: collectionByVdvk[v.code] || 0,
      processingKg: processingByVdvk[v.code] || 0,
      revenue: revenueByVdvk[v.code] || 0,
      utilised,
      balance: released - utilised,
    };
  });

  return c.json({
    totalSanctioned: sanctioned[0].total || 0,
    totalReleased: released[0].total || 0,
    totalExpenditure: expTotal.total || 0,
    balance: Number(released[0].total || 0) - Number(expTotal.total || 0),
    totalRevenue,
    totalCollectionKg,
    totalCollectionPcs,
    totalProcessingKg,
    totalProcessingPcs,
    vdvkBreakdown,
  });
});

// ─── REQUEST MONITORING ───────────────────────────────────────────────────
// Returns a normalized, role-aware list of approval-tracked requests.
//  - CC:   only their own Form 1 (MFP Collection) submissions
//  - PO:   view-only across all forms (approval enforced in the UI)
//  - DPM/APM/others: all forms; approve/reject authorization is enforced by
//    each form's own requireRole guard on the /forms/*/approve endpoints.
const REQUEST_PENDING_WITH: Record<string, string> = {
  form1: "APM", form2: "APM", form3: "APM", form8: "APM",
  form4: "DPM", form10: "DPM",
};

function daysPending(createdAt?: string | null): number {
  if (!createdAt) return 0;
  const ms = Date.now() - new Date(createdAt).getTime();
  if (Number.isNaN(ms)) return 0;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

dashboardRoutes.get("/requests", async (c) => {
  const user = c.get("user");
  const { status, vdvkCode } = c.req.query();

  const usersRows = await db.select({ id: users.id, name: users.name }).from(users);
  const userNames: Record<string, string> = {};
  usersRows.forEach((u) => { userNames[u.id] = u.name; });

  const isCC = user.roles.includes("CC");
  const statusCond = status ? eq(form1Collections.status, status as any) : undefined;
  const statusCond2 = status ? eq(form2StockTransfers.status, status as any) : undefined;
  const statusCond3 = status ? eq(form3Processing.status, status as any) : undefined;
  const statusCond4 = status ? eq(form4Sales.status, status as any) : undefined;
  const statusCond8 = status ? eq(form8Utilisation.status, status as any) : undefined;
  const statusCond10 = status ? eq(form10FundUtilisation.status, status as any) : undefined;

  // Form 1 — MFP Collection (CC is the only creator; restricted to own when CC)
  const f1Rows = await db.select({
    id: form1Collections.id, txnNo: form1Collections.txnNo,
    locationName: form1Collections.vdvkNameSnapshot,
    mandal: form1Collections.createdByMandalSnapshot,
    status: form1Collections.status, remarks: form1Collections.approvalRemarks,
    createdBy: form1Collections.createdBy, role: form1Collections.createdByRoleSnapshot,
    createdAt: form1Collections.createdAt,
  }).from(form1Collections)
    .where(isCC
      ? statusCond ? and(eq(form1Collections.createdBy, user.userId), statusCond) : eq(form1Collections.createdBy, user.userId)
      : statusCond);

  // Form 2 — Stock Transfer
  const f2Rows = await db.select({
    id: form2StockTransfers.id, txnNo: form2StockTransfers.txnNo,
    locationName: form2StockTransfers.sentFromNameSnapshot,
    status: form2StockTransfers.status, remarks: form2StockTransfers.approvalRemarks,
    createdBy: form2StockTransfers.createdBy, role: form2StockTransfers.createdByRoleSnapshot,
    createdAt: form2StockTransfers.createdAt,
  }).from(form2StockTransfers).where(statusCond2);

  // Form 3 — Processing
  const f3Rows = await db.select({
    id: form3Processing.id, txnNo: form3Processing.txnNo,
    locationName: form3Processing.processingLocationNameSnapshot,
    status: form3Processing.status, remarks: form3Processing.approvalRemarks,
    createdBy: form3Processing.createdBy, role: form3Processing.createdByRoleSnapshot,
    createdAt: form3Processing.createdAt,
  }).from(form3Processing).where(statusCond3);

  // Form 4 — Sales
  const f4Rows = await db.select({
    id: form4Sales.id, txnNo: form4Sales.txnNo,
    locationName: form4Sales.saleLocationNameSnapshot,
    status: form4Sales.status, remarks: form4Sales.approvalRemarks,
    createdBy: form4Sales.createdBy, role: form4Sales.createdByRoleSnapshot,
    createdAt: form4Sales.createdAt,
  }).from(form4Sales).where(statusCond4);

  // Form 8 — Machinery Utilisation
  const f8Rows = await db.select({
    id: form8Utilisation.id, txnNo: form8Utilisation.txnNo,
    status: form8Utilisation.status, remarks: form8Utilisation.verificationRemarks,
    createdBy: form8Utilisation.createdBy, role: form8Utilisation.createdByRoleSnapshot,
    createdAt: form8Utilisation.createdAt,
  }).from(form8Utilisation).where(statusCond8);

  // Form 10 — Weekly Fund Utilisation
  const f10Rows = await db.select({
    id: form10FundUtilisation.id, txnNo: form10FundUtilisation.txnNo,
    status: form10FundUtilisation.status, remarks: form10FundUtilisation.approvalRemarks,
    createdBy: form10FundUtilisation.createdBy,
    createdAt: form10FundUtilisation.createdAt,
  }).from(form10FundUtilisation).where(statusCond10);

  const fallbackLocation: Record<string, string> = {
    form8: "Machinery Utilisation",
    form10: "Weekly Fund Utilisation",
  };

  const collect = (rows: any[], formKey: string) => rows.map((r) => ({
    id: r.id,
    requestId: r.txnNo,
    formKey,
    formLabel: `Form ${formKey.replace("form", "")}`,
    submittedBy: userNames[r.createdBy] || r.createdBy,
    submittedByRole: r.role || "",
    locationName: r.locationName || fallbackLocation[formKey] || "",
    mandal: r.mandal || "",
    status: r.status,
    pendingWith: REQUEST_PENDING_WITH[formKey] || "None",
    remarks: r.remarks,
    createdAt: r.createdAt,
    daysPending: daysPending(r.createdAt),
  }));

  let requests: any[] = [];
  if (isCC) {
    // CC: own Form 1 submissions only
    requests = collect(f1Rows, "form1");
  } else {
    requests = [
      ...collect(f1Rows, "form1"),
      ...collect(f2Rows, "form2"),
      ...collect(f3Rows, "form3"),
      ...collect(f4Rows, "form4"),
      ...collect(f8Rows, "form8"),
      ...collect(f10Rows, "form10"),
    ];
  }

  if (vdvkCode) requests = requests.filter((r) => r.locationName === vdvkCode);

  requests.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return c.json({ requests });
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

// ─── CHART: MFP COLLECTION BY COMMODITY ───────────────────────────────────
// Aggregates approved Form 1 collection quantity grouped by commodity.
// Returns a single row per commodity merging Kg and Pieces totals.
dashboardRoutes.get("/collection-by-commodity", async (c) => {
  const { from, to } = c.req.query();
  const conds = [eq(form1Collections.status, "Approved")];
  if (from) conds.push(gte(form1Collections.collectionDate, from));
  if (to) conds.push(lte(form1Collections.collectionDate, to));

  const rows = await db
    .select({
      commodityCode: form1CollectionItems.commodityCode,
      commodityName: form1CollectionItems.commodityNameSnapshot,
      totalKg: sum(form1CollectionItems.qtyKg),
      totalPcs: sum(form1CollectionItems.qtyPieces),
    })
    .from(form1CollectionItems)
    .innerJoin(form1Collections, eq(form1Collections.id, form1CollectionItems.collectionId))
    .where(and(...conds))
    .groupBy(form1CollectionItems.commodityCode, form1CollectionItems.commodityNameSnapshot);

  return c.json(
    rows.map((r) => ({
      commodityCode: r.commodityCode,
      commodityName: r.commodityName,
      totalKg: Number(r.totalKg || 0),
      totalPcs: Number(r.totalPcs || 0),
    }))
  );
});

// ─── CHART: OPERATIONAL TREND (SALES REVENUE / PROCESSING / COLLECTION) ──
// Buckets approved transactions by calendar month (from their transaction date)
// so the UI can render time-series comparison graphs (Last month / week / type).
function monthKey(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  // Accept ISO (YYYY-MM-DD) or ISO datetime. Fall back to raw slice otherwise.
  const m = dateStr.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  return null;
}

dashboardRoutes.get("/operational-trend", async (c) => {
  const months = Math.min(Number(c.req.query("months")) || 12, 36);

  // Collection qty by month
  const collRows = await db
    .select({
      date: form1Collections.collectionDate,
      kg: sum(form1CollectionItems.qtyKg),
      pcs: sum(form1CollectionItems.qtyPieces),
    })
    .from(form1CollectionItems)
    .innerJoin(form1Collections, eq(form1Collections.id, form1CollectionItems.collectionId))
    .where(eq(form1Collections.status, "Approved"))
    .groupBy(form1Collections.collectionDate);

  // Processing qty by month
  const procRows = await db
    .select({
      date: form3Processing.processingDate,
      kg: sum(form3ProcessingItems.qtyTakenKg),
      pcs: sum(form3ProcessingItems.qtyTakenPcs),
    })
    .from(form3ProcessingItems)
    .innerJoin(form3Processing, eq(form3Processing.id, form3ProcessingItems.processingId))
    .where(eq(form3Processing.status, "Approved"))
    .groupBy(form3Processing.processingDate);

  // Sales revenue by month
  const salesRows = await db
    .select({
      date: form4Sales.saleDate,
      revenue: sum(form4SalesItems.totalSalesValue),
      kg: sum(form4SalesItems.soldKg),
      pcs: sum(form4SalesItems.soldPcs),
    })
    .from(form4SalesItems)
    .innerJoin(form4Sales, eq(form4Sales.id, form4SalesItems.salesId))
    .where(eq(form4Sales.status, "Approved"))
    .groupBy(form4Sales.saleDate);

  const buckets = new Map<string, { month: string; collectionKg: number; collectionPcs: number; processingKg: number; processingPcs: number; revenue: number; salesKg: number; salesPcs: number }>();

  const getBucket = (key: string) => {
    let b = buckets.get(key);
    if (!b) {
      b = { month: key, collectionKg: 0, collectionPcs: 0, processingKg: 0, processingPcs: 0, revenue: 0, salesKg: 0, salesPcs: 0 };
      buckets.set(key, b);
    }
    return b;
  };

  collRows.forEach((r) => {
    const k = monthKey(r.date);
    if (!k) return;
    const b = getBucket(k);
    b.collectionKg += Number(r.kg || 0);
    b.collectionPcs += Number(r.pcs || 0);
  });
  procRows.forEach((r) => {
    const k = monthKey(r.date);
    if (!k) return;
    const b = getBucket(k);
    b.processingKg += Number(r.kg || 0);
    b.processingPcs += Number(r.pcs || 0);
  });
  salesRows.forEach((r) => {
    const k = monthKey(r.date);
    if (!k) return;
    const b = getBucket(k);
    b.revenue += Number(r.revenue || 0);
    b.salesKg += Number(r.kg || 0);
    b.salesPcs += Number(r.pcs || 0);
  });

  const sorted = Array.from(buckets.values()).sort((a, b) => a.month.localeCompare(b.month));
  return c.json(sorted.slice(-months));
});

// ─── CHART/TABLE: FACILITY PERFORMANCE (Hub / MPC / Haat Bazaar) ────────
// Aggregates operational KPIs per facility:
//   machinery count, VDVKs served, MFP collection, processing,
//   raw & processed sales, total revenue.
dashboardRoutes.get("/facility-performance", requireRole("PO", "APD", "DPM"), async (c) => {
  const type = (c.req.query("type") || "Hub").trim();
  const from = c.req.query("from");
  const to = c.req.query("to");

  const facilityRows = await db.select({
    code: facilities.code,
    name: facilities.name,
    type: facilities.type,
    mandal: facilities.mandal,
  }).from(facilities)
    .where(and(eq(facilities.type, type), eq(facilities.status, "Approved")));

  // Machinery count by facility
  const machRows = await db
    .select({ facilityCode: machTable.currentFacilityCode, c: count() })
    .from(machTable)
    .where(eq(machTable.status, "Approved"))
    .groupBy(machTable.currentFacilityCode);
  const machByFac: Record<string, number> = {};
  machRows.forEach((r) => { if (r.facilityCode) machByFac[r.facilityCode] = r.c; });

  // VDVKs served by facility
  const vdvkRows = await db
    .select({ facilityCode: facilityVdvkMapping.facilityCode, c: count() })
    .from(facilityVdvkMapping)
    .groupBy(facilityVdvkMapping.facilityCode);
  const vdvkByFac: Record<string, number> = {};
  vdvkRows.forEach((r) => { vdvkByFac[r.facilityCode] = r.c; });

  // VDVK -> facility map (for collection attribution)
  const facMapRows = await db
    .select({ facilityCode: facilityVdvkMapping.facilityCode, vdvkCode: facilityVdvkMapping.vdvkCode })
    .from(facilityVdvkMapping);
  const facOfVdvk: Record<string, string> = {};
  facMapRows.forEach((r) => { facOfVdvk[r.vdvkCode] = r.facilityCode; });

  // MFP collection by VDVK (approved Form 1)
  const collConds = [eq(form1Collections.status, "Approved")];
  if (from) collConds.push(gte(form1Collections.collectionDate, from));
  if (to) collConds.push(lte(form1Collections.collectionDate, to));
  const collRows = await db
    .select({ vdvkCode: form1Collections.vdvkCode, kg: sum(form1CollectionItems.qtyKg) })
    .from(form1CollectionItems)
    .innerJoin(form1Collections, eq(form1Collections.id, form1CollectionItems.collectionId))
    .where(and(...collConds))
    .groupBy(form1Collections.vdvkCode);
  const collByFac: Record<string, number> = {};
  collRows.forEach((r) => {
    const f = facOfVdvk[r.vdvkCode];
    if (!f) return;
    collByFac[f] = (collByFac[f] || 0) + Number(r.kg || 0);
  });

  // Processing by facility (approved Form 3, keyed by location code)
  const procConds = [eq(form3Processing.status, "Approved")];
  if (from) procConds.push(gte(form3Processing.processingDate, from));
  if (to) procConds.push(lte(form3Processing.processingDate, to));
  const procRows = await db
    .select({ loc: form3Processing.processingLocationCode, kg: sum(form3ProcessingItems.qtyTakenKg) })
    .from(form3ProcessingItems)
    .innerJoin(form3Processing, eq(form3Processing.id, form3ProcessingItems.processingId))
    .where(and(...procConds))
    .groupBy(form3Processing.processingLocationCode);
  const procByFac: Record<string, number> = {};
  procRows.forEach((r) => { procByFac[r.loc] = (procByFac[r.loc] || 0) + Number(r.kg || 0); });

  // Sales by facility (approved Form 4): split raw/processed + revenue
  const salesConds = [eq(form4Sales.status, "Approved")];
  if (from) salesConds.push(gte(form4Sales.saleDate, from));
  if (to) salesConds.push(lte(form4Sales.saleDate, to));
  const salesRows = await db
    .select({
      loc: form4Sales.saleLocationCode,
      productType: form4SalesItems.productType,
      kg: sum(form4SalesItems.soldKg),
      revenue: sum(form4SalesItems.totalSalesValue),
    })
    .from(form4SalesItems)
    .innerJoin(form4Sales, eq(form4Sales.id, form4SalesItems.salesId))
    .where(and(...salesConds))
    .groupBy(form4Sales.saleLocationCode, form4SalesItems.productType);
  const rawSalesByFac: Record<string, number> = {};
  const procSalesByFac: Record<string, number> = {};
  const revenueByFac: Record<string, number> = {};
  salesRows.forEach((r) => {
    const isRaw = (r.productType || "").toLowerCase().includes("raw");
    const kg = Number(r.kg || 0);
    const rev = Number(r.revenue || 0);
    (isRaw ? rawSalesByFac : procSalesByFac)[r.loc] = ((isRaw ? rawSalesByFac : procSalesByFac)[r.loc] || 0) + kg;
    revenueByFac[r.loc] = (revenueByFac[r.loc] || 0) + rev;
  });

  const results = facilityRows.map((f) => ({
    code: f.code,
    name: f.name,
    type: f.type,
    mandal: f.mandal || "",
    machineryCount: machByFac[f.code] || 0,
    vdvksServed: vdvkByFac[f.code] || 0,
    collectionKg: collByFac[f.code] || 0,
    processingKg: procByFac[f.code] || 0,
    rawSalesKg: rawSalesByFac[f.code] || 0,
    processedSalesKg: procSalesByFac[f.code] || 0,
    revenue: revenueByFac[f.code] || 0,
  }));

  return c.json(results);
});

// ─── CHART/TABLE: COMMODITY PERFORMANCE RANKING ─────────────────────────
// Per commodity: MFP Collection, Processed, Unprocessed Stock, Sales, Revenue.
// Unprocessed Stock = Collection (F1) − Taken for Processing (F3)
//                     − Direct Raw Material Sales (F4, productType = Raw).
dashboardRoutes.get("/commodity-ranking", requireRole("PO", "APD", "DPM"), async (c) => {
  const { from, to } = c.req.query();

  // Collection by commodity (approved Form 1)
  const collConds = [eq(form1Collections.status, "Approved")];
  if (from) collConds.push(gte(form1Collections.collectionDate, from));
  if (to) collConds.push(lte(form1Collections.collectionDate, to));
  const collRows = await db
    .select({
      code: form1CollectionItems.commodityCode,
      name: form1CollectionItems.commodityNameSnapshot,
      kg: sum(form1CollectionItems.qtyKg),
      pcs: sum(form1CollectionItems.qtyPieces),
    })
    .from(form1CollectionItems)
    .innerJoin(form1Collections, eq(form1Collections.id, form1CollectionItems.collectionId))
    .where(and(...collConds))
    .groupBy(form1CollectionItems.commodityCode, form1CollectionItems.commodityNameSnapshot);

  // Processed by commodity (approved Form 3)
  const procConds = [eq(form3Processing.status, "Approved")];
  if (from) procConds.push(gte(form3Processing.processingDate, from));
  if (to) procConds.push(lte(form3Processing.processingDate, to));
  const procRows = await db
    .select({
      code: form3ProcessingItems.commodityCode,
      kg: sum(form3ProcessingItems.qtyTakenKg),
      pcs: sum(form3ProcessingItems.qtyTakenPcs),
    })
    .from(form3ProcessingItems)
    .innerJoin(form3Processing, eq(form3Processing.id, form3ProcessingItems.processingId))
    .where(and(...procConds))
    .groupBy(form3ProcessingItems.commodityCode);

  // Sales by commodity (approved Form 4) — split raw/processed + revenue
  const salesConds = [eq(form4Sales.status, "Approved")];
  if (from) salesConds.push(gte(form4Sales.saleDate, from));
  if (to) salesConds.push(lte(form4Sales.saleDate, to));
  const salesRows = await db
    .select({
      code: form4SalesItems.commodityCode,
      productType: form4SalesItems.productType,
      kg: sum(form4SalesItems.soldKg),
      pcs: sum(form4SalesItems.soldPcs),
      revenue: sum(form4SalesItems.totalSalesValue),
    })
    .from(form4SalesItems)
    .innerJoin(form4Sales, eq(form4Sales.id, form4SalesItems.salesId))
    .where(and(...salesConds))
    .groupBy(form4SalesItems.commodityCode, form4SalesItems.productType);

  const buckets = new Map<string, {
    commodityCode: string; commodityName: string;
    collectionKg: number; collectionPcs: number;
    processedKg: number; processedPcs: number;
    salesKg: number; salesPcs: number;
    rawSalesKg: number;
    revenue: number;
  }>();

  const get = (code: string, name: string) => {
    let b = buckets.get(code);
    if (!b) {
      b = {
        commodityCode: code, commodityName: name || code,
        collectionKg: 0, collectionPcs: 0, processedKg: 0, processedPcs: 0,
        salesKg: 0, salesPcs: 0, rawSalesKg: 0, revenue: 0,
      };
      buckets.set(code, b);
    }
    return b;
  };

  collRows.forEach((r) => {
    const b = get(r.code, r.name);
    b.collectionKg += Number(r.kg || 0);
    b.collectionPcs += Number(r.pcs || 0);
  });
  procRows.forEach((r) => {
    const b = get(r.code, r.code);
    b.processedKg += Number(r.kg || 0);
    b.processedPcs += Number(r.pcs || 0);
  });
  salesRows.forEach((r) => {
    const b = get(r.code, r.code);
    const isRaw = (r.productType || "").toLowerCase().includes("raw");
    const kg = Number(r.kg || 0);
    b.salesKg += kg;
    b.salesPcs += Number(r.pcs || 0);
    b.revenue += Number(r.revenue || 0);
    if (isRaw) b.rawSalesKg += kg;
  });

  const results = Array.from(buckets.values()).map((b) => ({
    ...b,
    unprocessedStockKg: b.collectionKg - b.processedKg - b.rawSalesKg,
    unprocessedStockPcs: b.collectionPcs - b.processedPcs,
  }));

  return c.json(results);
});

// ─── MANDAL PERFORMANCE CARDS ────────────────────────────────────────────
// Per Mandal: VDVK count, beneficiaries, MFP collection, revenue, and counts
// of Hubs / Multipurpose Centres / Haat Bazaars.
dashboardRoutes.get("/mandal-performance", requireRole("PO", "APD", "DPM"), async (c) => {
  const [vdvkRows, benRows, facRows, collRows, salesRows] = await Promise.all([
    db.select({ mandal: vdvks.mandal, c: count() })
      .from(vdvks).where(eq(vdvks.status, "Approved")).groupBy(vdvks.mandal),
    db.select({ mandal: beneficiaries.mandal, c: count() })
      .from(beneficiaries).where(eq(beneficiaries.status, "Approved")).groupBy(beneficiaries.mandal),
    db.select({ mandal: facilities.mandal, type: facilities.type, c: count() })
      .from(facilities).where(eq(facilities.status, "Approved")).groupBy(facilities.mandal, facilities.type),
    db.select({ mandal: vdvks.mandal, kg: sum(form1CollectionItems.qtyKg) })
      .from(form1CollectionItems)
      .innerJoin(form1Collections, eq(form1Collections.id, form1CollectionItems.collectionId))
      .innerJoin(vdvks, eq(vdvks.code, form1Collections.vdvkCode))
      .where(eq(form1Collections.status, "Approved"))
      .groupBy(vdvks.mandal),
    db.select({ mandal: vdvks.mandal, revenue: sum(form4SalesItems.totalSalesValue) })
      .from(form4SalesItems)
      .innerJoin(form4Sales, eq(form4Sales.id, form4SalesItems.salesId))
      .innerJoin(vdvks, eq(vdvks.code, form4SalesItems.vdvkCode))
      .where(eq(form4Sales.status, "Approved"))
      .groupBy(vdvks.mandal),
  ]);

  const map = new Map<string, {
    mandal: string; vdvks: number; beneficiaries: number;
    collectionKg: number; revenue: number;
    hubs: number; mpc: number; haatBazaars: number;
  }>();

  const get = (m: string | null) => {
    const key = (m || "Unassigned").trim() || "Unassigned";
    let b = map.get(key);
    if (!b) {
      b = { mandal: key, vdvks: 0, beneficiaries: 0, collectionKg: 0, revenue: 0, hubs: 0, mpc: 0, haatBazaars: 0 };
      map.set(key, b);
    }
    return b;
  };

  vdvkRows.forEach((r) => { get(r.mandal).vdvks += r.c; });
  benRows.forEach((r) => { get(r.mandal).beneficiaries += r.c; });
  facRows.forEach((r) => {
    const b = get(r.mandal);
    const t = (r.type || "").toLowerCase();
    if (t.includes("hub")) b.hubs += r.c;
    else if (t.includes("mpc") || t.includes("multipurpose") || t.includes("collection")) b.mpc += r.c;
    else if (t.includes("haat")) b.haatBazaars += r.c;
  });
  collRows.forEach((r) => { get(r.mandal).collectionKg += Number(r.kg || 0); });
  salesRows.forEach((r) => { get(r.mandal).revenue += Number(r.revenue || 0); });

  const results = Array.from(map.values()).sort((a, b) => b.collectionKg - a.collectionKg);
  return c.json(results);
});

