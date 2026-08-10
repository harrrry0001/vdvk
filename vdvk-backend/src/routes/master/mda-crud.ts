import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "../../db/index.js";
import { stockLedger, stockMovementLog } from "../../db/schema/shared/stock-ledger.js";
import { auditTrail, rejectedRecords } from "../../db/schema/shared/audit-notification.js";
import { commodityRates } from "../../db/schema/master/commodity-grade-rate.js";
import { commodities } from "../../db/schema/master/commodity-grade-rate.js";
import { grades } from "../../db/schema/master/commodity-grade-rate.js";
import { schemes, expenditureHeads, customers, suppliers } from "../../db/schema/master/scheme-exphead-customer-supplier.js";
import { users, userRoles, userTransferHistory } from "../../db/schema/master/user.js";
import { facilities, facilityVdvkMapping, facilitySupervisors, facilityCommodities } from "../../db/schema/master/facility.js";
import { machinery, machineryTransfers } from "../../db/schema/master/machinery.js";
import { requireRole, HonoEnv} from "../../middleware/auth.js";
import { eq, and, desc, sql, count, sum, gte, lte } from "drizzle-orm";

export const mdaRoutes = new Hono<HonoEnv>();

// ═══════════════════════════════════════════════════════════════════════════
// 1. AVAILABLE STOCK QUERY (needed for Forms 2, 3, 4 pre-fill)
// ═══════════════════════════════════════════════════════════════════════════
mdaRoutes.get("/stock", async (c) => {
  const { vdvkCode, facilityCode, commodityCode, stockType } = c.req.query();
  const conds = [eq(stockLedger.isActive, true)];

  if (vdvkCode) conds.push(eq(stockLedger.vdvkCode, vdvkCode));
  if (facilityCode) conds.push(eq(stockLedger.facilityCode, facilityCode));
  if (commodityCode) conds.push(eq(stockLedger.commodityCode, commodityCode));
  if (stockType) conds.push(eq(stockLedger.stockType, stockType as any));

  const rows = await db.select({
    id: stockLedger.id,
    vdvkCode: stockLedger.vdvkCode, vdvkName: stockLedger.vdvkNameSnapshot,
    beneficiaryId: stockLedger.beneficiaryId, beneficiaryName: stockLedger.beneficiaryNameSnapshot,
    commodityCode: stockLedger.commodityCode, commodityName: stockLedger.commodityNameSnapshot,
    gradeCode: stockLedger.gradeCode, gradeName: stockLedger.gradeNameSnapshot,
    stockType: stockLedger.stockType, facilityCode: stockLedger.facilityCode,
    facilityName: stockLedger.facilityNameSnapshot,
    unit: stockLedger.unit,
    qtyKg: stockLedger.qtyKg, qtyPieces: stockLedger.qtyPieces,
    ratePerKg: stockLedger.ratePerKg, ratePerPiece: stockLedger.ratePerPiece,
    totalValue: stockLedger.totalValue, sourceTxnType: stockLedger.sourceTxnType,
  }).from(stockLedger).where(and(...conds)).orderBy(desc(stockLedger.createdAt));

  return c.json(rows);
});

// Stock summary by commodity (for dashboard dropdowns)
mdaRoutes.get("/stock/summary", async (c) => {
  const rows = await db.select({
    commodityCode: stockLedger.commodityCode, commodityName: stockLedger.commodityNameSnapshot,
    stockType: stockLedger.stockType,
    totalKg: sum(stockLedger.qtyKg), totalPcs: sum(stockLedger.qtyPieces),
    totalValue: sum(stockLedger.totalValue),
  }).from(stockLedger).where(eq(stockLedger.isActive, true))
    .groupBy(stockLedger.commodityCode, stockLedger.commodityNameSnapshot, stockLedger.stockType);

  return c.json(rows);
});

// ─── STOCK MOVEMENT LOG VIEWER (append-only history) ─────────────────────
mdaRoutes.get("/stock/movements", requireRole("PO", "DPM", "MDA"), async (c) => {
  const { vdvkCode, commodityCode, formType, performedBy, page = "1", limit = "50" } = c.req.query();
  const conds = [];
  if (vdvkCode) conds.push(eq(stockLedger.vdvkCode, vdvkCode));
  if (commodityCode) conds.push(eq(stockLedger.commodityCode, commodityCode));
  if (formType) conds.push(eq(stockMovementLog.referenceTxnType, formType as any));
  if (performedBy) conds.push(eq(stockMovementLog.performedBy, performedBy));

  const rows = await db.select({
    id: stockMovementLog.id,
    stockLedgerId: stockMovementLog.stockLedgerId,
    movementType: stockMovementLog.movementType,
    qtyKgChange: stockMovementLog.qtyKgChange, qtyPiecesChange: stockMovementLog.qtyPiecesChange,
    resultingQtyKg: stockMovementLog.resultingQtyKg, resultingQtyPieces: stockMovementLog.resultingQtyPieces,
    referenceTxnType: stockMovementLog.referenceTxnType, referenceTxnId: stockMovementLog.referenceTxnId,
    performedBy: stockMovementLog.performedBy, remarks: stockMovementLog.remarks,
    createdAt: stockMovementLog.createdAt,
    vdvkCode: stockLedger.vdvkCode, vdvkName: stockLedger.vdvkNameSnapshot,
    commodityCode: stockLedger.commodityCode, commodityName: stockLedger.commodityNameSnapshot,
    gradeName: stockLedger.gradeNameSnapshot,
    stockType: stockLedger.stockType, facilityCode: stockLedger.facilityCode,
    facilityName: stockLedger.facilityNameSnapshot,
  }).from(stockMovementLog)
    .innerJoin(stockLedger, eq(stockMovementLog.stockLedgerId, stockLedger.id))
    .where(and(...conds))
    .orderBy(desc(stockMovementLog.createdAt))
    .limit(Number(limit)).offset((Number(page) - 1) * Number(limit));

  return c.json(rows);
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. RATE MASTER CRUD
// ═══════════════════════════════════════════════════════════════════════════
mdaRoutes.get("/rates/all", async (c) => {
  const rows = await db.select().from(commodityRates).orderBy(desc(commodityRates.effectiveFrom));
  return c.json(rows);
});

// Rate pre-fill: given commodity + grade + date, return active rate
mdaRoutes.get("/rates/prefill", async (c) => {
  const { commodityCode, gradeCode, date } = c.req.query();
  if (!commodityCode) return c.json({ error: "commodityCode required" }, 400);

  const conds = [eq(commodityRates.commodityCode, commodityCode)];
  if (gradeCode) conds.push(eq(commodityRates.gradeCode, gradeCode));
  // Always bound to an effective window (default: today) so closed rates
  // from revisions are never prefilled.
  const asOf = date ?? new Date().toISOString().slice(0, 10);
  conds.push(sql`${commodityRates.effectiveFrom} <= ${asOf}`);
  conds.push(sql`(${commodityRates.effectiveTo} IS NULL OR ${commodityRates.effectiveTo} >= ${asOf})`);

  const [rate] = await db.select().from(commodityRates).where(and(...conds)).limit(1);
  return c.json(rate || null);
});

mdaRoutes.post("/rates", requireRole("MDA"), async (c) => {
  const body = await c.req.json();
  await db.insert(commodityRates).values({
    commodityCode: body.commodityCode, gradeCode: body.gradeCode,
    unit: body.unit, ratePerKg: body.ratePerKg, ratePerPiece: body.ratePerPiece,
    effectiveFrom: body.effectiveFrom || new Date().toISOString().slice(0, 10),
  });
  return c.json({ created: true }, 201);
});

// Rate revision: close old rate + insert new
mdaRoutes.put("/rates/:id/revise", requireRole("MDA"), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json<{ ratePerKg?: number; ratePerPiece?: number }>();
  const [oldRate] = await db.select().from(commodityRates).where(eq(commodityRates.id, Number(id))).limit(1);
  if (!oldRate) return c.json({ error: "Not found" }, 404);

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Close old rate
  await db.update(commodityRates).set({ effectiveTo: yesterday }).where(eq(commodityRates.id, oldRate.id));

  // Insert new rate
  await db.insert(commodityRates).values({
    commodityCode: oldRate.commodityCode, gradeCode: oldRate.gradeCode,
    unit: oldRate.unit,
    ratePerKg: body.ratePerKg ?? oldRate.ratePerKg,
    ratePerPiece: body.ratePerPiece ?? oldRate.ratePerPiece,
    effectiveFrom: today,
  });

  return c.json({ revised: true });
});

// ─── FULL MDA CRUD (Commodities, Grades, Schemes, Exp-Heads, Customers, Suppliers)
// ───────────────────────────────────────────────────────────────────────────────
// Per-entity defaults for NOT NULL columns the payload may omit
// (keyed by the code prefix passed to crudRoutes — "CMD", "GRD", ...)
const CRUD_DEFAULTS: Record<string, Record<string, unknown>> = {
  CMD: { unitEffectiveFrom: () => new Date().toISOString().slice(0, 10) },
  GRD: { effectiveFrom: () => new Date().toISOString().slice(0, 10) },
  SCH: { effectiveFrom: () => new Date().toISOString().slice(0, 10) },
  EXP: { effectiveFrom: () => new Date().toISOString().slice(0, 10) },
  CUST: { effectiveFrom: () => new Date().toISOString().slice(0, 10) },
  SUP: { effectiveFrom: () => new Date().toISOString().slice(0, 10) },
};

function crudRoutes(entity: string, table: any, pk = "code") {
  const router = new Hono<HonoEnv>();

  router.get("/", async (c) => {
    const rows = await db.select().from(table).orderBy(desc(table.createdAt));
    return c.json(rows);
  });

  router.post("/", requireRole("MDA"), async (c) => {
    const body = await c.req.json();
    if (!body[pk]) body[pk] = `${entity}-${uuid().slice(0, 8).toUpperCase()}`;
    const defaults = CRUD_DEFAULTS[entity] || {};
    for (const [k, v] of Object.entries(defaults)) {
      if (body[k] === undefined) body[k] = typeof v === "function" ? (v as () => unknown)() : v;
    }
    await db.insert(table).values({ ...body, createdAt: new Date().toISOString() });
    return c.json({ [pk]: body[pk] }, 201);
  });

  router.put(`/:${pk}`, requireRole("MDA"), async (c) => {
    const val = c.req.param(pk);
    const body = await c.req.json();
    await db.update(table).set({ ...body, updatedAt: new Date().toISOString() }).where(eq(table[pk], val));
    return c.json({ updated: true });
  });

  router.delete(`/:${pk}`, requireRole("MDA"), async (c) => {
    const val = c.req.param(pk);
    await db.update(table).set({ status: "Inactive" } as any).where(eq(table[pk], val));
    return c.json({ deactivated: true });
  });

  return router;
}

mdaRoutes.route("/commodities", crudRoutes("CMD", commodities));
mdaRoutes.route("/grades", crudRoutes("GRD", grades));
mdaRoutes.route("/schemes", crudRoutes("SCH", schemes));
mdaRoutes.route("/expenditure-heads", crudRoutes("EXP", expenditureHeads));
mdaRoutes.route("/customers", crudRoutes("CUST", customers));
mdaRoutes.route("/suppliers", crudRoutes("SUP", suppliers));

// ═══════════════════════════════════════════════════════════════════════════
// 4. USER MANAGEMENT (Admin/MDA)
// ═══════════════════════════════════════════════════════════════════════════
mdaRoutes.get("/users", requireRole("PO", "APD", "DPM", "MDA"), async (c) => {
  const rows = await db.select().from(users).orderBy(desc(users.createdAt));
  const usersWithRoles = await Promise.all(rows.map(async (u) => {
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, u.id));
    return { ...u, passwordHash: undefined, roles };
  }));
  return c.json(usersWithRoles);
});

mdaRoutes.get("/users/:id", requireRole("PO", "APD", "DPM", "MDA"), async (c) => {
  const { id } = c.req.param();
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u) return c.json({ error: "Not found" }, 404);
  const roles = await db.select().from(userRoles).where(eq(userRoles.userId, id));
  const transferHistory = await db.select().from(userTransferHistory)
    .where(eq(userTransferHistory.userId, id))
    .orderBy(desc(userTransferHistory.createdAt))
    .limit(20);
  return c.json({ ...u, passwordHash: undefined, roles, transferHistory });
});

mdaRoutes.post("/users", requireRole("MDA"), async (c) => {
  const body = await c.req.json<{ name: string; username: string; password: string; designation: string; mandal?: string; vdvkCode?: string; facilityCode?: string; roles: string[] }>();
  const pwdHash = await bcrypt.hash(body.password, 10);
  const id = `USER-${uuid().slice(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();

  await db.insert(users).values({
    id, name: body.name, username: body.username, passwordHash: pwdHash,
    designation: body.designation, mandal: body.mandal, vdvkCode: body.vdvkCode, facilityCode: body.facilityCode,
    createdAt: now, updatedAt: now,
  });

  if (body.roles?.length) {
    await db.insert(userRoles).values(body.roles.map((r, i) => ({
      userId: id, role: r, isPrimary: i === 0, assignedFrom: now,
    })));
  }

  return c.json({ id }, 201);
});

mdaRoutes.patch("/users/:id/deactivate", requireRole("MDA"), async (c) => {
  const { id } = c.req.param();
  await db.update(users).set({ status: "Inactive", updatedAt: new Date().toISOString() }).where(eq(users.id, id));
  return c.json({ deactivated: true });
});

mdaRoutes.patch("/users/:id/reset-password", requireRole("MDA"), async (c) => {
  const { id } = c.req.param();
  const { newPassword } = await c.req.json<{ newPassword: string }>();
  const pwdHash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash: pwdHash, passwordChangedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(users.id, id));
  return c.json({ reset: true });
});

mdaRoutes.patch("/users/:id/transfer", requireRole("MDA"), async (c) => {
  const { id } = c.req.param();
  const { mandal, vdvkCode, facilityCode, reason } = await c.req.json();
  const user = c.get("user");
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) return c.json({ error: "Not found" }, 404);

  const upd: any = { updatedAt: new Date().toISOString() };
  const changes: { field: string; oldValue: string | null; newValue: string | null }[] = [];
  if (mandal !== undefined && mandal !== target.mandal) {
    upd.mandal = mandal;
    changes.push({ field: "mandal", oldValue: target.mandal || null, newValue: mandal });
  }
  if (vdvkCode !== undefined && vdvkCode !== target.vdvkCode) {
    upd.vdvkCode = vdvkCode;
    changes.push({ field: "vdvkCode", oldValue: target.vdvkCode || null, newValue: vdvkCode });
  }
  if (facilityCode !== undefined && facilityCode !== target.facilityCode) {
    upd.facilityCode = facilityCode;
    changes.push({ field: "facilityCode", oldValue: target.facilityCode || null, newValue: facilityCode });
  }

  if (changes.length) {
    await db.update(users).set(upd).where(eq(users.id, id));
    await db.insert(userTransferHistory).values(changes.map(ch => ({
      userId: id, changedField: ch.field, oldValue: ch.oldValue, newValue: ch.newValue,
      reason: reason || null, changedBy: user.userId,
    })));
  }
  return c.json({ transferred: true, changes });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. AUDIT TRAIL VIEWER
// ═══════════════════════════════════════════════════════════════════════════
mdaRoutes.get("/audit-trail", requireRole("PO", "DPM", "MDA"), async (c) => {
  const { transactionId, formType, action, page = "1", limit = "35" } = c.req.query();
  const conds = [];
  if (transactionId) conds.push(eq(auditTrail.transactionId, transactionId));
  if (formType) conds.push(eq(auditTrail.formType, formType as any));
  if (action) conds.push(eq(auditTrail.action, action as any));

  // Slim column select keeps the trail view readable
  const rows = await db.select({
    id: auditTrail.id, transactionId: auditTrail.transactionId,
    formType: auditTrail.formType, action: auditTrail.action,
    performedBy: auditTrail.performedBy, performerRoleSnapshot: auditTrail.performerRoleSnapshot,
    performedAt: auditTrail.performedAt, remarks: auditTrail.remarks,
  }).from(auditTrail).where(and(...conds))
    .orderBy(desc(auditTrail.performedAt))
    .limit(Number(limit)).offset((Number(page) - 1) * Number(limit));

  return c.json(rows);
});

// ─── REJECTED RECORDS VIEWER ──────────────────────────────────────────────
mdaRoutes.get("/rejected-records", requireRole("PO", "DPM", "MDA"), async (c) => {
  const { formType, page = "1", limit = "50" } = c.req.query();
  const cond = formType ? [eq(rejectedRecords.formType, formType as any)] : [];
  const rows = await db.select({
    id: rejectedRecords.id, originalTransactionId: rejectedRecords.originalTransactionId,
    formType: rejectedRecords.formType, rejectedBy: rejectedRecords.rejectedBy,
    rejectionRemarks: rejectedRecords.rejectionRemarks, rejectedAt: rejectedRecords.rejectedAt,
    resubmittedAs: rejectedRecords.resubmittedAs,
  }).from(rejectedRecords).where(and(...cond))
    .orderBy(desc(rejectedRecords.rejectedAt))
    .limit(Number(limit)).offset((Number(page) - 1) * Number(limit));
  return c.json(rows);
});
mdaRoutes.post("/machinery/:id/transfer", requireRole("MDA"), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json<{ toFacilityCode: string; toFacilityType?: string; reason?: string; remarks?: string }>();
  const [m] = await db.select().from(machinery).where(eq(machinery.id, id)).limit(1);
  if (!m) return c.json({ error: "Machinery not found" }, 404);

  // Create transfer record
  await db.insert(machineryTransfers).values({
    machineryId: id, transferDate: new Date().toISOString().slice(0, 10),
    fromFacilityCode: m.currentFacilityCode,
    toFacilityType: body.toFacilityType || "Hub",
    toFacilityCode: body.toFacilityCode,
    reason: body.reason, remarks: body.remarks,
  });

  // Mark machinery as in transit
  await db.update(machinery).set({ currentStatus: "In Transit", updatedAt: new Date().toISOString() }).where(eq(machinery.id, id));

  return c.json({ transferred: true, status: "In Transit" });
});

mdaRoutes.patch("/machinery/:id/complete-transfer", requireRole("MDA"), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json<{ dateReceived?: string; condition?: string; remarks?: string }>();

  // Update machinery location and status
  const [transfer] = await db.select().from(machineryTransfers).where(and(eq(machineryTransfers.machineryId, id), eq(machineryTransfers.isComplete, false))).limit(1);
  if (!transfer) return c.json({ error: "No active transfer found" }, 404);

  await db.update(machinery).set({
    currentFacilityCode: transfer.toFacilityCode,
    currentStatus: "Available",
    updatedAt: new Date().toISOString(),
  }).where(eq(machinery.id, id));

  // Complete transfer record
  await db.update(machineryTransfers).set({
    dateReceived: body.dateReceived || new Date().toISOString().slice(0, 10),
    conditionOnArrival: (body.condition as any) || "Good",
    completionRemarks: body.remarks, isComplete: true,
  }).where(eq(machineryTransfers.id, transfer.id));

  return c.json({ completed: true, newLocation: transfer.toFacilityCode });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. FACILITY SUMMARY (for dropdowns in forms)
// ═══════════════════════════════════════════════════════════════════════════
mdaRoutes.get("/facilities/by-type", async (c) => {
  const { type } = c.req.query();
  const conds = type ? [eq(facilities.type, type as any)] : [];
  const rows = await db.select({ code: facilities.code, name: facilities.name, type: facilities.type, mandal: facilities.mandal }).from(facilities).where(and(...conds));
  return c.json(rows);
});

// Facilities serving a VDVK (from facility_vdvk_mapping)
mdaRoutes.get("/facilities/by-vdvk/:vdvkCode", async (c) => {
  const { vdvkCode } = c.req.param();
  const rows = await db.select({
    facilityCode: facilityVdvkMapping.facilityCode,
    name: facilities.name, type: facilities.type, mandal: facilities.mandal,
  }).from(facilityVdvkMapping)
    .innerJoin(facilities, eq(facilityVdvkMapping.facilityCode, facilities.code))
    .where(eq(facilityVdvkMapping.vdvkCode, vdvkCode));
  return c.json(rows);
});

// ─── FACILITY → COMMODITY MAPPINGS ───────────────────────────────────────
mdaRoutes.get("/facilities/:code/commodities", async (c) => {
  const { code } = c.req.param();
  const rows = await db.select().from(facilityCommodities).where(eq(facilityCommodities.facilityCode, code));
  return c.json(rows);
});

mdaRoutes.post("/facilities/:code/commodities", requireRole("MDA"), async (c) => {
  const { code } = c.req.param();
  const { commodityCodes } = await c.req.json<{ commodityCodes: string[] }>();
  await db.delete(facilityCommodities).where(eq(facilityCommodities.facilityCode, code));
  if (commodityCodes?.length) {
    await db.insert(facilityCommodities).values(commodityCodes.map(cc => ({ facilityCode: code, commodityCode: cc })));
  }
  return c.json({ updated: true, count: commodityCodes?.length || 0 });
});

// ─── FACILITY → VDVK MAPPINGS ────────────────────────────────────────────
mdaRoutes.get("/facilities/:code/vdvks", async (c) => {
  const { code } = c.req.param();
  const rows = await db.select().from(facilityVdvkMapping).where(eq(facilityVdvkMapping.facilityCode, code));
  return c.json(rows);
});

mdaRoutes.post("/facilities/:code/vdvks", requireRole("MDA"), async (c) => {
  const { code } = c.req.param();
  const { vdvkCodes } = await c.req.json<{ vdvkCodes: string[] }>();
  await db.delete(facilityVdvkMapping).where(eq(facilityVdvkMapping.facilityCode, code));
  if (vdvkCodes?.length) {
    await db.insert(facilityVdvkMapping).values(vdvkCodes.map(vc => ({ facilityCode: code, vdvkCode: vc })));
  }
  return c.json({ updated: true, count: vdvkCodes?.length || 0 });
});

// ─── FACILITY → SUPERVISOR ASSIGNMENTS ───────────────────────────────────
mdaRoutes.get("/facilities/:code/supervisors", async (c) => {
  const { code } = c.req.param();
  const rows = await db.select().from(facilitySupervisors).where(eq(facilitySupervisors.facilityCode, code));
  return c.json(rows);
});

mdaRoutes.post("/facilities/:code/supervisors", requireRole("MDA"), async (c) => {
  const { code } = c.req.param();
  const body = await c.req.json<{ supervisorUserId: string; supervisorNameSnapshot: string; assignedFrom?: string; assignedTo?: string }>();
  const today = new Date().toISOString().slice(0, 10);
  // Close any open assignment for this facility before assigning a new one
  await db.update(facilitySupervisors)
    .set({ assignedTo: today })
    .where(and(eq(facilitySupervisors.facilityCode, code), sql`${facilitySupervisors.assignedTo} IS NULL`));
  await db.insert(facilitySupervisors).values({
    facilityCode: code,
    supervisorUserId: body.supervisorUserId,
    supervisorNameSnapshot: body.supervisorNameSnapshot,
    assignedFrom: body.assignedFrom || today,
    assignedTo: body.assignedTo || null,
  });
  return c.json({ assigned: true }, 201);
});
