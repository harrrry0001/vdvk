import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { db } from "../../db/index.js";
import { form3Processing as f3Header, form3ProcessingItems as f3Items, form3PackagingDetails as f3Packaging } from "../../db/schema/transaction/form3-processing.js";
import { requireRole, HonoEnv} from "../../middleware/auth.js";
import { eq, and, desc, inArray } from "drizzle-orm";
import { notifyRole, notifyUser } from "../../lib/notify.js";
import { recordRejection } from "../../lib/rejection.js";
import { findLot, deductStock, addStock } from "../../lib/stock.js";

export const form3Routes = new Hono<HonoEnv>();
const txnPrefix = "PRC";

const packagingSchema = z.object({
  packetSize: z.string(), numberOfPackets: z.number(),
  totalQtyKg: z.number().nullable(), totalQtyPieces: z.number().nullable(),
});

const itemSchema = z.object({
  vdvkCode: z.string(), vdvkNameSnapshot: z.string(),
  beneficiaryId: z.string().nullable().optional(), beneficiaryNameSnapshot: z.string().nullable().optional(),
  commodityCode: z.string(), commodityNameSnapshot: z.string(),
  gradeCode: z.string().nullable().optional(), gradeNameSnapshot: z.string().nullable().optional(),
  unit: z.enum(["Kg", "Pieces", "Both"]),
  availableStockKg: z.number().nullable(), qtyTakenKg: z.number().nullable(), ratePerKg: z.number().nullable(),
  availableStockPcs: z.number().nullable(), qtyTakenPcs: z.number().nullable(), ratePerPiece: z.number().nullable(),
  finishedKg: z.number().nullable(), finishedPcs: z.number().nullable(),
  finalCostPerKg: z.number().nullable(), finalCostPerPiece: z.number().nullable(),
  remarks: z.string().nullable().optional(), sourceStockLedgerIds: z.array(z.number()).optional(),
  packaging: z.array(packagingSchema).optional(),
});

const formSchema = z.object({
  processingLocationCode: z.string(), processingLocationNameSnapshot: z.string(),
  processingDate: z.string(), overallRemarks: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

function calcItem(item: any) {
  const rawMat = ((item.qtyTakenKg || 0) * (item.ratePerKg || 0)) + ((item.qtyTakenPcs || 0) * (item.ratePerPiece || 0));
  const finishedVal = ((item.finishedKg || 0) * (item.finalCostPerKg || 0)) + ((item.finishedPcs || 0) * (item.finalCostPerPiece || 0));
  const procCost = finishedVal - rawMat;
  const yieldKg = (item.qtyTakenKg || 0) - (item.finishedKg || 0);
  const yieldPcs = (item.qtyTakenPcs || 0) - (item.finishedPcs || 0);
  return { rawMaterialValue: rawMat, finishedValue: finishedVal, processingCost: procCost, valueAddition: procCost, yieldLossKg: yieldKg, yieldLossPcs: yieldPcs };
}

// CREATE
form3Routes.post("/", requireRole("Hub Supervisor", "MPC Supervisor", "Haat Bazaar Supervisor", "VDVK Facility Supervisor"), async (c) => {
  const body = formSchema.parse(await c.req.json());
  const user = c.get("user");
  const id = uuid(); const txnNo = `${txnPrefix}-${Date.now().toString(36).toUpperCase()}`;

  await db.insert(f3Header).values({
    id, txnNo, processingLocationCode: body.processingLocationCode, processingLocationNameSnapshot: body.processingLocationNameSnapshot,
    processingDate: body.processingDate, overallRemarks: body.overallRemarks,
    createdBy: user.userId, createdByRoleSnapshot: user.activeRole,
  });

  for (const item of body.items) {
    const calced = calcItem(item);
    const { packaging, ...rest } = item;
    const [ins] = await db.insert(f3Items).values({
      processingId: id, ...rest,
      rawMaterialValue: calced.rawMaterialValue, finishedValue: calced.finishedValue,
      processingCost: calced.processingCost, valueAddition: calced.valueAddition,
      yieldLossKg: calced.yieldLossKg, yieldLossPcs: calced.yieldLossPcs,
    }).returning({ id: f3Items.id });

    if (packaging?.length) {
      await db.insert(f3Packaging).values(packaging.map(p => ({
        processingItemId: ins.id,
        packetSize: p.packetSize, numberOfPackets: p.numberOfPackets,
        totalQtyKg: p.totalQtyKg ?? null, totalQtyPieces: p.totalQtyPieces ?? null,
      })));
    }
  }

  return c.json({ id, txnNo, status: "Draft" }, 201);
});

// SUBMIT
form3Routes.patch("/:id/submit", requireRole("Hub Supervisor", "MPC Supervisor", "Haat Bazaar Supervisor", "VDVK Facility Supervisor"), async (c) => {
  const { id } = c.req.param();
  const [r] = await db.select().from(f3Header).where(eq(f3Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Draft") return c.json({ error: "Only drafts can be submitted" }, 400);
  await db.update(f3Header).set({ status: "Submitted", submittedAt: new Date().toISOString() }).where(eq(f3Header.id, id));
  await notifyRole("APM", {
    type: "SUBMITTED", title: "Processing form submitted",
    body: `Form 3 ${r.txnNo} awaits approval`,
    relatedTransactionId: id,
  });
  return c.json({ id, status: "Submitted" });
});

// APPROVE / REJECT (APM)
form3Routes.patch("/:id/approve", requireRole("APM"), async (c) => {
  const { id } = c.req.param();
  const { approved, remarks } = await c.req.json<{ approved: boolean; remarks?: string }>();
  const user = c.get("user");
  const [r] = await db.select().from(f3Header).where(eq(f3Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Submitted") return c.json({ error: "Record not in submitted state" }, 400);

  if (approved) {
    const items = await db.select().from(f3Items).where(eq(f3Items.processingId, id));
    for (const item of items) {
      // Deduct raw stock (first-lot accounting)
      if ((item.qtyTakenKg || 0) > 0 || (item.qtyTakenPcs || 0) > 0) {
        const lot = await findLot(db, {
          vdvkCode: item.vdvkCode, commodityCode: item.commodityCode, stockType: "Raw",
        });
        if (lot) {
          await deductStock(db, lot, item.qtyTakenKg || 0, item.qtyTakenPcs || 0, {
            movementType: "OUT", referenceTxnType: "Form3", referenceTxnId: id,
            performedBy: user.userId, remarks: `Form 3 ${r.txnNo} raw material consumed`,
          });
        }
      }
      // Add finished goods
      if ((item.finishedKg || 0) > 0 || (item.finishedPcs || 0) > 0) {
        await addStock(db, {
          vdvkCode: item.vdvkCode, vdvkNameSnapshot: item.vdvkNameSnapshot,
          beneficiaryId: item.beneficiaryId, beneficiaryNameSnapshot: item.beneficiaryNameSnapshot,
          commodityCode: item.commodityCode, commodityNameSnapshot: item.commodityNameSnapshot,
          gradeCode: item.gradeCode, gradeNameSnapshot: item.gradeNameSnapshot,
          stockType: "Processed", facilityCode: r.processingLocationCode, facilityNameSnapshot: r.processingLocationNameSnapshot,
          unit: item.unit, qtyKg: item.finishedKg || 0, qtyPieces: item.finishedPcs || 0,
          ratePerKg: item.finalCostPerKg, ratePerPiece: item.finalCostPerPiece,
          totalValue: item.finishedValue, sourceTxnType: "Form3_Output", sourceTxnId: id, parentLotId: item.id,
        }, {
          movementType: "IN", referenceTxnType: "Form3_Output", referenceTxnId: id,
          performedBy: user.userId, remarks: `Form 3 ${r.txnNo} finished goods`,
        });
      }
    }
  }

  await db.update(f3Header).set({
    status: approved ? "Approved" : "Rejected",
    approvalRemarks: remarks || null, approvedBy: user.userId, approvedAt: new Date().toISOString(),
  }).where(eq(f3Header.id, id));

  if (!approved) {
    await recordRejection({ formType: "Form3", transactionId: id, data: r, rejectedBy: user.userId, remarks });
  }

  await notifyUser(r.createdBy, {
    type: approved ? "APPROVED" : "REJECTED",
    title: approved ? "Processing form approved" : "Processing form rejected",
    body: `Form 3 ${r.txnNo} was ${approved ? "approved" : "rejected"}${remarks ? ` — ${remarks}` : ""}`,
    relatedTransactionId: id,
  });

  return c.json({ id, status: approved ? "Approved" : "Rejected" });
});

// LIST
form3Routes.get("/", async (c) => {
  const { status, page = "1", limit = "20" } = c.req.query();
  const cond = status ? [eq(f3Header.status, status as any)] : [];
  const rows = await db.select().from(f3Header).where(and(...cond)).orderBy(desc(f3Header.createdAt)).limit(Number(limit)).offset((Number(page) - 1) * Number(limit));
  return c.json(rows);
});

// GET BY ID
form3Routes.get("/:id", async (c) => {
  const { id } = c.req.param();
  const [h] = await db.select().from(f3Header).where(eq(f3Header.id, id)).limit(1);
  if (!h) return c.json({ error: "Not found" }, 404);
  const items = await db.select().from(f3Items).where(eq(f3Items.processingId, id));
  const itemIds = items.map(i => i.id);
  const packagingRows = itemIds.length
    ? await db.select().from(f3Packaging).where(inArray(f3Packaging.processingItemId, itemIds))
    : [];
  const packByItem = new Map<number, typeof packagingRows>();
  for (const p of packagingRows) {
    const arr = packByItem.get(p.processingItemId) || [];
    arr.push(p);
    packByItem.set(p.processingItemId, arr);
  }
  return c.json({ ...h, items: items.map(i => ({ ...i, packaging: packByItem.get(i.id) || [] })) });
});

// UPDATE DRAFT
form3Routes.put("/:id", requireRole("Hub Supervisor", "MPC Supervisor", "Haat Bazaar Supervisor", "VDVK Facility Supervisor"), async (c) => {
  const { id } = c.req.param();
  const body = formSchema.partial().parse(await c.req.json());
  const [r] = await db.select().from(f3Header).where(eq(f3Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Draft") return c.json({ error: "Only drafts can be edited" }, 400);

  const upd: any = { updatedAt: new Date().toISOString() };
  for (const k of ['processingLocationCode', 'processingLocationNameSnapshot', 'processingDate', 'overallRemarks']) {
    if ((body as any)[k] !== undefined) upd[k] = (body as any)[k];
  }
  await db.update(f3Header).set(upd).where(eq(f3Header.id, id));

  if (body.items) {
    const itemIds = await db.select({ id: f3Items.id }).from(f3Items).where(eq(f3Items.processingId, id));
    await db.delete(f3Packaging).where(inArray(f3Packaging.processingItemId, itemIds.map(i => i.id)));
    await db.delete(f3Items).where(eq(f3Items.processingId, id));
    for (const item of body.items) {
      const calced = calcItem(item);
      const { packaging, ...rest } = item;
      const [ins] = await db.insert(f3Items).values({
        processingId: id, ...rest,
        rawMaterialValue: calced.rawMaterialValue, finishedValue: calced.finishedValue,
        processingCost: calced.processingCost, valueAddition: calced.valueAddition,
        yieldLossKg: calced.yieldLossKg, yieldLossPcs: calced.yieldLossPcs,
      }).returning({ id: f3Items.id });

      if (packaging?.length) {
        await db.insert(f3Packaging).values(packaging.map(p => ({
          processingItemId: ins.id,
          packetSize: p.packetSize, numberOfPackets: p.numberOfPackets,
          totalQtyKg: p.totalQtyKg ?? null, totalQtyPieces: p.totalQtyPieces ?? null,
        })));
      }
    }
  }
  return c.json({ id, status: "Draft" });
});

form3Routes.delete("/:id", requireRole("Hub Supervisor", "MPC Supervisor", "Haat Bazaar Supervisor", "VDVK Facility Supervisor"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const [r] = await db.select().from(f3Header).where(eq(f3Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.createdBy !== user.userId) return c.json({ error: "Only the creator can delete this record" }, 403);
  if (r.status !== "Draft") return c.json({ error: "Only drafts can be deleted" }, 400);
  const itemIds = await db.select({ id: f3Items.id }).from(f3Items).where(eq(f3Items.processingId, id));
  await db.delete(f3Packaging).where(inArray(f3Packaging.processingItemId, itemIds.map(i => i.id)));
  await db.delete(f3Items).where(eq(f3Items.processingId, id));
  await db.delete(f3Header).where(eq(f3Header.id, id));
  return c.json({ id, deleted: true });
});

form3Routes.patch("/:id/reopen", requireRole("Hub Supervisor", "MPC Supervisor", "Haat Bazaar Supervisor", "VDVK Facility Supervisor"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const [r] = await db.select().from(f3Header).where(eq(f3Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.createdBy !== user.userId) return c.json({ error: "Only the creator can reopen this record" }, 403);
  if (r.status !== "Rejected") return c.json({ error: "Only rejected records can be reopened" }, 400);
  await db.update(f3Header)
    .set({ status: "Draft", approvalRemarks: null, approvedBy: null, approvedAt: null })
    .where(eq(f3Header.id, id));
  return c.json({ id, status: "Draft" });
});
