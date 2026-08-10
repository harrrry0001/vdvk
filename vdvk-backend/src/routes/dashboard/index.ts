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
import { form10ExpenditureItems, form10FundUtilisation } from "../../db/schema/transaction/form9-10-12.js";
import { stockLedger } from "../../db/schema/shared/stock-ledger.js";
import { schemes } from "../../db/schema/master/scheme-exphead-customer-supplier.js";
import { form2StockTransfers } from "../../db/schema/transaction/form2-stock-transfer.js";
import { form8Utilisation } from "../../db/schema/transaction/form8-utilisation.js";
import { users } from "../../db/schema/master/user.js";
import { eq, count, sum, and } from "drizzle-orm";
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

