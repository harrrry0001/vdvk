import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { db } from "../../db/index.js";
import { form1Collections as f1Header, form1CollectionItems as f1Items } from "../../db/schema/transaction/form1-collection.js";
import { requireRole, HonoEnv} from "../../middleware/auth.js";
import { eq, and, desc } from "drizzle-orm";
import { addStock } from "../../lib/stock.js";
import { notifyRole, notifyUser } from "../../lib/notify.js";
import { recordRejection } from "../../lib/rejection.js";

export const form1Routes = new Hono<HonoEnv>();
const txnPrefix = "MFPC";

const itemSchema = z.object({
  beneficiaryId: z.string(), beneficiaryNameSnapshot: z.string(),
  commodityCode: z.string(), commodityNameSnapshot: z.string(),
  gradeCode: z.string().nullable().optional(), gradeNameSnapshot: z.string().nullable().optional(),
  unit: z.enum(["Kg", "Pieces", "Both"]), unitSnapshot: z.string(),
  qtyKg: z.number().nullable().optional(), qtyPieces: z.number().nullable().optional(),
  ratePerKg: z.number().nullable().optional(), ratePerPiece: z.number().nullable().optional(),
  rateSnapshot: z.string().nullable().optional(), totalCost: z.number(),
  remarks: z.string().nullable().optional(),
});

const form1Schema = z.object({
  vdvkCode: z.string(), vdvkNameSnapshot: z.string(),
  collectionDate: z.string(),
  placeOfSubmission: z.enum(["VDVK Facility", "Multipurpose Centre", "Haat Bazaar", "Hub"]),
  transactionType: z.enum(["Cash", "Bank Transfer", "Credit", "Advance", "Other"]),
  overallRemarks: z.string().nullable().optional(),
  items: z.array(itemSchema).min(1),
});

form1Routes.post("/", requireRole("CC"), async (c) => {
  const body = form1Schema.parse(await c.req.json());
  const user = c.get("user");
  const id = uuid(); const txnNo = `${txnPrefix}-${Date.now().toString(36).toUpperCase()}`;

  await db.insert(f1Header).values({
    id, txnNo, vdvkCode: body.vdvkCode, vdvkNameSnapshot: body.vdvkNameSnapshot,
    collectionDate: body.collectionDate, placeOfSubmission: body.placeOfSubmission,
    transactionType: body.transactionType, overallRemarks: body.overallRemarks,
    status: "Draft", createdByRoleSnapshot: user.activeRole,
    createdByMandalSnapshot: user.mandal || null, createdBy: user.userId,
  });

  if (body.items.length > 0) {
    await db.insert(f1Items).values(body.items.map(i => ({
      collectionId: id, ...i,
      gradeCode: i.gradeCode || null, gradeNameSnapshot: i.gradeNameSnapshot || null,
      qtyKg: i.qtyKg || null, qtyPieces: i.qtyPieces || null,
      ratePerKg: i.ratePerKg || null, ratePerPiece: i.ratePerPiece || null,
    })));
  }
  return c.json({ id, txnNo, status: "Draft" }, 201);
});

form1Routes.patch("/:id/submit", requireRole("CC"), async (c) => {
  const { id } = c.req.param();
  const [r] = await db.select().from(f1Header).where(eq(f1Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Draft") return c.json({ error: "Only drafts can be submitted" }, 400);
  await db.update(f1Header).set({ status: "Submitted", submittedAt: new Date().toISOString() }).where(eq(f1Header.id, id));
  await notifyRole("APM", {
    type: "SUBMITTED", title: "Collection form submitted",
    body: `Form 1 ${r.txnNo} (${r.vdvkNameSnapshot}) awaits approval`,
    relatedTransactionId: id,
  });
  return c.json({ id, status: "Submitted" });
});

form1Routes.patch("/:id/approve", requireRole("APM"), async (c) => {
  const { id } = c.req.param();
  const { approved, remarks } = await c.req.json<{ approved: boolean; remarks?: string }>();
  const user = c.get("user");
  const [r] = await db.select().from(f1Header).where(eq(f1Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Submitted") return c.json({ error: "Not submitted" }, 400);

  if (approved) {
    const items = await db.select().from(f1Items).where(eq(f1Items.collectionId, id));
    for (const item of items) {
      await addStock(db, {
        vdvkCode: r.vdvkCode, vdvkNameSnapshot: r.vdvkNameSnapshot,
        beneficiaryId: item.beneficiaryId, beneficiaryNameSnapshot: item.beneficiaryNameSnapshot,
        commodityCode: item.commodityCode, commodityNameSnapshot: item.commodityNameSnapshot,
        gradeCode: item.gradeCode, gradeNameSnapshot: item.gradeNameSnapshot,
        stockType: "Raw",
        facilityCode: r.vdvkCode, facilityNameSnapshot: r.vdvkNameSnapshot,
        unit: item.unit, qtyKg: item.qtyKg || 0, qtyPieces: item.qtyPieces || 0,
        ratePerKg: item.ratePerKg, ratePerPiece: item.ratePerPiece,
        totalValue: item.totalCost,
        sourceTxnType: "Form1", sourceTxnId: id,
      }, {
        movementType: "IN", referenceTxnType: "Form1", referenceTxnId: id,
        performedBy: user.userId, remarks: `Form 1 ${r.txnNo} collection`,
      });
    }
  }

  await db.update(f1Header).set({
    status: approved ? "Approved" : "Rejected",
    approvalRemarks: remarks || null, approvedBy: user.userId, approvedAt: new Date().toISOString(),
  }).where(eq(f1Header.id, id));

  if (!approved) {
    await recordRejection({ formType: "Form1", transactionId: id, data: r, rejectedBy: user.userId, remarks });
  }

  await notifyUser(r.createdBy, {
    type: approved ? "APPROVED" : "REJECTED",
    title: approved ? "Collection form approved" : "Collection form rejected",
    body: `Form 1 ${r.txnNo} was ${approved ? "approved" : "rejected"}${remarks ? ` — ${remarks}` : ""}`,
    relatedTransactionId: id,
  });

  return c.json({ id, status: approved ? "Approved" : "Rejected" });
});

form1Routes.get("/", async (c) => {
  const { status, vdvkCode, page = "1", limit = "20" } = c.req.query();
  const conds = [];
  if (status) conds.push(eq(f1Header.status, status as any));
  if (vdvkCode) conds.push(eq(f1Header.vdvkCode, vdvkCode));
  const rows = await db.select().from(f1Header).where(and(...conds)).orderBy(desc(f1Header.createdAt)).limit(Number(limit)).offset((Number(page) - 1) * Number(limit));
  return c.json(rows);
});

form1Routes.get("/:id", async (c) => {
  const { id } = c.req.param();
  const [h] = await db.select().from(f1Header).where(eq(f1Header.id, id)).limit(1);
  if (!h) return c.json({ error: "Not found" }, 404);
  const items = await db.select().from(f1Items).where(eq(f1Items.collectionId, id));
  return c.json({ ...h, items });
});

form1Routes.put("/:id", requireRole("CC"), async (c) => {
  const { id } = c.req.param();
  const body = form1Schema.partial().parse(await c.req.json());
  const [r] = await db.select().from(f1Header).where(eq(f1Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Draft") return c.json({ error: "Only drafts can be edited" }, 400);

  const upd: any = { updatedAt: new Date().toISOString() };
  for (const k of ['vdvkCode', 'vdvkNameSnapshot', 'collectionDate', 'placeOfSubmission', 'transactionType', 'overallRemarks']) {
    if ((body as any)[k] !== undefined) upd[k] = (body as any)[k];
  }
  await db.update(f1Header).set(upd).where(eq(f1Header.id, id));

  if (body.items) {
    await db.delete(f1Items).where(eq(f1Items.collectionId, id));
    await db.insert(f1Items).values(body.items.map(i => ({
      collectionId: id, ...i,
      gradeCode: i.gradeCode || null, gradeNameSnapshot: i.gradeNameSnapshot || null,
      qtyKg: i.qtyKg || null, qtyPieces: i.qtyPieces || null,
      ratePerKg: i.ratePerKg || null, ratePerPiece: i.ratePerPiece || null,
    })));
  }
  return c.json({ id, status: "Draft" });
});

form1Routes.delete("/:id", requireRole("CC"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const [r] = await db.select().from(f1Header).where(eq(f1Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.createdBy !== user.userId) return c.json({ error: "Only the creator can delete this record" }, 403);
  if (r.status !== "Draft") return c.json({ error: "Only drafts can be deleted" }, 400);
  await db.delete(f1Items).where(eq(f1Items.collectionId, id));
  await db.delete(f1Header).where(eq(f1Header.id, id));
  return c.json({ id, deleted: true });
});

form1Routes.patch("/:id/reopen", requireRole("CC"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const [r] = await db.select().from(f1Header).where(eq(f1Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.createdBy !== user.userId) return c.json({ error: "Only the creator can reopen this record" }, 403);
  if (r.status !== "Rejected") return c.json({ error: "Only rejected records can be reopened" }, 400);
  await db.update(f1Header)
    .set({ status: "Draft", approvalRemarks: null, approvedBy: null, approvedAt: null })
    .where(eq(f1Header.id, id));
  return c.json({ id, status: "Draft" });
});
