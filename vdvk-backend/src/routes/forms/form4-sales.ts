import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { db } from "../../db/index.js";
import { form4Sales as f4Header, form4SalesItems as f4Items, form4SalesPackaging as f4Packaging } from "../../db/schema/transaction/form4-sales.js";
import { requireRole, HonoEnv} from "../../middleware/auth.js";
import { eq, and, desc, inArray } from "drizzle-orm";
import { notifyRole, notifyUser } from "../../lib/notify.js";
import { recordRejection } from "../../lib/rejection.js";
import { findLot, deductStock } from "../../lib/stock.js";

export const form4Routes = new Hono<HonoEnv>();
const txnPrefix = "SAL";

const packagingSchema = z.object({
  packetSize: z.string(), numberOfPackets: z.number(),
  totalQty: z.number(),
});

const itemSchema = z.object({
  customerCode: z.string(), customerNameSnapshot: z.string(), customerMobileSnapshot: z.string().optional(),
  invoiceNo: z.string(),
  vdvkCode: z.string(), vdvkNameSnapshot: z.string(),
  beneficiaryId: z.string().nullable().optional(), beneficiaryNameSnapshot: z.string().nullable().optional(),
  productType: z.enum(["Raw Material", "Processed Product"]),
  commodityCode: z.string(), commodityNameSnapshot: z.string(),
  gradeCode: z.string().nullable().optional(), gradeNameSnapshot: z.string().nullable().optional(),
  salesUnit: z.enum(["Kg", "Pieces", "Both"]),
  availableKg: z.number().nullable(), availablePcs: z.number().nullable(),
  packetDetails: z.string().nullable(),
  soldKg: z.number().nullable(), soldPcs: z.number().nullable(),
  pricePerKg: z.number().nullable(), pricePerPiece: z.number().nullable(),
  remarks: z.string().nullable().optional(),
  sourceStockLedgerIds: z.array(z.number()).optional(),
  packaging: z.array(packagingSchema).optional(),
});

const formSchema = z.object({
  saleLocationCode: z.string(), saleLocationNameSnapshot: z.string(),
  saleDate: z.string(), overallRemarks: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

function calcSalesValues(item: any) {
  const totalSales = ((item.soldKg || 0) * (item.pricePerKg || 0)) + ((item.soldPcs || 0) * (item.pricePerPiece || 0));
  const closingKg = (item.availableKg || 0) - (item.soldKg || 0);
  const closingPcs = (item.availablePcs || 0) - (item.soldPcs || 0);
  return { totalSalesValue: totalSales, closingKg: Math.max(0, closingKg), closingPcs: Math.max(0, closingPcs) };
}

// CREATE (APM)
form4Routes.post("/", requireRole("APM"), async (c) => {
  const body = formSchema.parse(await c.req.json());
  const user = c.get("user");
  const id = uuid(); const txnNo = `${txnPrefix}-${Date.now().toString(36).toUpperCase()}`;

  await db.insert(f4Header).values({
    id, txnNo, saleLocationCode: body.saleLocationCode, saleLocationNameSnapshot: body.saleLocationNameSnapshot,
    saleDate: body.saleDate, overallRemarks: body.overallRemarks,
    createdBy: user.userId, createdByRoleSnapshot: user.activeRole,
  });

  for (const item of body.items) {
    const calced = calcSalesValues(item);
    const invNo = item.invoiceNo || `INV-${Date.now().toString(36).toUpperCase()}`;
    const { packaging, ...rest } = item;
    const [ins] = await db.insert(f4Items).values({
      salesId: id, ...rest, invoiceNo: invNo,
      totalSalesValue: calced.totalSalesValue, closingKg: calced.closingKg, closingPcs: calced.closingPcs,
    }).returning({ id: f4Items.id });

    if (packaging?.length) {
      await db.insert(f4Packaging).values(packaging.map(p => ({
        salesItemId: ins.id,
        packetSize: p.packetSize, numberOfPackets: p.numberOfPackets, totalQty: p.totalQty,
      })));
    }
  }
  return c.json({ id, txnNo, status: "Draft" }, 201);
});

// SUBMIT
form4Routes.patch("/:id/submit", requireRole("APM"), async (c) => {
  const { id } = c.req.param();
  const [r] = await db.select().from(f4Header).where(eq(f4Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Draft") return c.json({ error: "Only drafts can be submitted" }, 400);
  await db.update(f4Header).set({ status: "Submitted", submittedAt: new Date().toISOString() }).where(eq(f4Header.id, id));
  await notifyRole("DPM", {
    type: "SUBMITTED", title: "Sales form submitted",
    body: `Form 4 ${r.txnNo} awaits approval`,
    relatedTransactionId: id,
  });
  return c.json({ id, status: "Submitted" });
});

// APPROVE / REJECT (DPM — only DPM can approve Form 4)
form4Routes.patch("/:id/approve", requireRole("DPM"), async (c) => {
  const { id } = c.req.param();
  const { approved, remarks } = await c.req.json<{ approved: boolean; remarks?: string }>();
  const user = c.get("user");
  const [r] = await db.select().from(f4Header).where(eq(f4Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Submitted") return c.json({ error: "Record not in submitted state" }, 400);

  if (approved) {
    const items = await db.select().from(f4Items).where(eq(f4Items.salesId, id));
    for (const item of items) {
      // Deduct sold stock (first-lot accounting)
      if ((item.soldKg || 0) > 0 || (item.soldPcs || 0) > 0) {
        const lot = await findLot(db, {
          vdvkCode: item.vdvkCode, commodityCode: item.commodityCode,
          stockType: item.productType === "Processed Product" ? "Processed" : "Raw",
        });
        if (lot) {
          await deductStock(db, lot, item.soldKg || 0, item.soldPcs || 0, {
            movementType: "OUT", referenceTxnType: "Form4", referenceTxnId: id,
            performedBy: user.userId, remarks: `Form 4 ${r.txnNo} sales (${item.invoiceNo})`,
          });
        }
      }
    }
  }

  await db.update(f4Header).set({
    status: approved ? "Approved" : "Rejected",
    approvalRemarks: remarks || null, approvedBy: user.userId, approvedAt: new Date().toISOString(),
  }).where(eq(f4Header.id, id));

  if (!approved) {
    await recordRejection({ formType: "Form4", transactionId: id, data: r, rejectedBy: user.userId, remarks });
  }

  await notifyUser(r.createdBy, {
    type: approved ? "APPROVED" : "REJECTED",
    title: approved ? "Sales form approved" : "Sales form rejected",
    body: `Form 4 ${r.txnNo} was ${approved ? "approved" : "rejected"}${remarks ? ` — ${remarks}` : ""}`,
    relatedTransactionId: id,
  });

  return c.json({ id, status: approved ? "Approved" : "Rejected" });
});

// LIST
form4Routes.get("/", async (c) => {
  const { status, page = "1", limit = "20" } = c.req.query();
  const cond = status ? [eq(f4Header.status, status as any)] : [];
  const rows = await db.select().from(f4Header).where(and(...cond)).orderBy(desc(f4Header.createdAt)).limit(Number(limit)).offset((Number(page) - 1) * Number(limit));
  return c.json(rows);
});

// GET BY ID
form4Routes.get("/:id", async (c) => {
  const { id } = c.req.param();
  const [h] = await db.select().from(f4Header).where(eq(f4Header.id, id)).limit(1);
  if (!h) return c.json({ error: "Not found" }, 404);
  const items = await db.select().from(f4Items).where(eq(f4Items.salesId, id));
  const itemIds = items.map(i => i.id);
  const packagingRows = itemIds.length
    ? await db.select().from(f4Packaging).where(inArray(f4Packaging.salesItemId, itemIds))
    : [];
  const packByItem = new Map<number, typeof packagingRows>();
  for (const p of packagingRows) {
    const arr = packByItem.get(p.salesItemId) || [];
    arr.push(p);
    packByItem.set(p.salesItemId, arr);
  }
  return c.json({ ...h, items: items.map(i => ({ ...i, packaging: packByItem.get(i.id) || [] })) });
});

// UPDATE DRAFT
form4Routes.put("/:id", requireRole("APM"), async (c) => {
  const { id } = c.req.param();
  const body = formSchema.partial().parse(await c.req.json());
  const [r] = await db.select().from(f4Header).where(eq(f4Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Draft") return c.json({ error: "Only drafts can be edited" }, 400);

  const upd: any = { updatedAt: new Date().toISOString() };
  for (const k of ['saleLocationCode', 'saleLocationNameSnapshot', 'saleDate', 'overallRemarks']) {
    if ((body as any)[k] !== undefined) upd[k] = (body as any)[k];
  }
  await db.update(f4Header).set(upd).where(eq(f4Header.id, id));

  if (body.items) {
    const itemIds = await db.select({ id: f4Items.id }).from(f4Items).where(eq(f4Items.salesId, id));
    await db.delete(f4Packaging).where(inArray(f4Packaging.salesItemId, itemIds.map(i => i.id)));
    await db.delete(f4Items).where(eq(f4Items.salesId, id));
    for (const item of body.items) {
      const calced = calcSalesValues(item);
      const { packaging, ...rest } = item;
      const [ins] = await db.insert(f4Items).values({
        salesId: id, ...rest, invoiceNo: item.invoiceNo || `INV-${Date.now().toString(36).toUpperCase()}`,
        totalSalesValue: calced.totalSalesValue, closingKg: calced.closingKg, closingPcs: calced.closingPcs,
      }).returning({ id: f4Items.id });

      if (packaging?.length) {
        await db.insert(f4Packaging).values(packaging.map(p => ({
          salesItemId: ins.id,
          packetSize: p.packetSize, numberOfPackets: p.numberOfPackets, totalQty: p.totalQty,
        })));
      }
    }
  }
  return c.json({ id, status: "Draft" });
});

form4Routes.delete("/:id", requireRole("APM"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const [r] = await db.select().from(f4Header).where(eq(f4Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.createdBy !== user.userId) return c.json({ error: "Only the creator can delete this record" }, 403);
  if (r.status !== "Draft") return c.json({ error: "Only drafts can be deleted" }, 400);
  const itemIds = await db.select({ id: f4Items.id }).from(f4Items).where(eq(f4Items.salesId, id));
  await db.delete(f4Packaging).where(inArray(f4Packaging.salesItemId, itemIds.map(i => i.id)));
  await db.delete(f4Items).where(eq(f4Items.salesId, id));
  await db.delete(f4Header).where(eq(f4Header.id, id));
  return c.json({ id, deleted: true });
});

form4Routes.patch("/:id/reopen", requireRole("APM"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const [r] = await db.select().from(f4Header).where(eq(f4Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.createdBy !== user.userId) return c.json({ error: "Only the creator can reopen this record" }, 403);
  if (r.status !== "Rejected") return c.json({ error: "Only rejected records can be reopened" }, 400);
  await db.update(f4Header)
    .set({ status: "Draft", approvalRemarks: null, approvedBy: null, approvedAt: null })
    .where(eq(f4Header.id, id));
  return c.json({ id, status: "Draft" });
});
