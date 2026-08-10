import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { db } from "../../db/index.js";
import { form2StockTransfers as f2Header, form2TransferItems as f2Items } from "../../db/schema/transaction/form2-stock-transfer.js";
import { requireRole, HonoEnv} from "../../middleware/auth.js";
import { eq, and, desc } from "drizzle-orm";
import { notifyRole, notifyUser } from "../../lib/notify.js";
import { recordRejection } from "../../lib/rejection.js";
import { findLot, deductStock, addStock } from "../../lib/stock.js";

export const form2Routes = new Hono<HonoEnv>();
const txnPrefix = "ST";

const itemSchema = z.object({
  vdvkCode: z.string(), vdvkNameSnapshot: z.string(),
  beneficiaryId: z.string(), beneficiaryNameSnapshot: z.string(),
  commodityCode: z.string(), commodityNameSnapshot: z.string(),
  gradeCode: z.string().nullable().optional(), gradeNameSnapshot: z.string().nullable().optional(),
  goodsType: z.enum(["Raw", "Processed"]),
  unit: z.enum(["Kg", "Pieces", "Both"]),
  availableKg: z.number().nullable(), transferQtyKg: z.number().nullable(),
  availablePieces: z.number().nullable(), transferQtyPieces: z.number().nullable(),
  ratePerKg: z.number().nullable(), ratePerPiece: z.number().nullable(),
  totalValue: z.number(),
});

const formSchema = z.object({
  transferDate: z.string(), sentFromFacilityCode: z.string(), sentFromNameSnapshot: z.string(),
  sentToFacilityCode: z.string(), sentToNameSnapshot: z.string(),
  sentBy: z.string().optional(), sentByNameSnapshot: z.string().optional(),
  vehicleDetails: z.string().optional(), driverName: z.string().optional(), driverMobile: z.string().optional(),
  overallRemarks: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

// CREATE DRAFT
form2Routes.post("/", requireRole("Hub Supervisor", "MPC Supervisor", "Haat Bazaar Supervisor", "VDVK Facility Supervisor"), async (c) => {
  const body = formSchema.parse(await c.req.json());
  const user = c.get("user");
  const id = uuid(); const txnNo = `${txnPrefix}-${Date.now().toString(36).toUpperCase()}`;

  await db.insert(f2Header).values({
    id, txnNo, transferDate: body.transferDate,
    sentFromFacilityCode: body.sentFromFacilityCode, sentFromNameSnapshot: body.sentFromNameSnapshot,
    sentToFacilityCode: body.sentToFacilityCode, sentToNameSnapshot: body.sentToNameSnapshot,
    sentBy: body.sentBy, sentByNameSnapshot: body.sentByNameSnapshot,
    vehicleDetails: body.vehicleDetails, driverName: body.driverName, driverMobile: body.driverMobile,
    overallRemarks: body.overallRemarks,
    createdBy: user.userId, createdByRoleSnapshot: user.activeRole,
  });

  if (body.items.length > 0) {
    await db.insert(f2Items).values(body.items.map(i => ({ ...i, transferId: id })));
  }
  return c.json({ id, txnNo, status: "Draft" }, 201);
});

// SUBMIT
form2Routes.patch("/:id/submit", requireRole("Hub Supervisor", "MPC Supervisor", "Haat Bazaar Supervisor", "VDVK Facility Supervisor"), async (c) => {
  const { id } = c.req.param();
  const [r] = await db.select().from(f2Header).where(eq(f2Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Draft") return c.json({ error: "Only draft records can be submitted" }, 400);
  await db.update(f2Header).set({ status: "Submitted", submittedAt: new Date().toISOString() }).where(eq(f2Header.id, id));
  await notifyRole("APM", {
    type: "SUBMITTED", title: "Stock transfer submitted",
    body: `Form 2 ${r.txnNo} awaits approval`,
    relatedTransactionId: id,
  });
  return c.json({ id, status: "Submitted" });
});

// APPROVE / REJECT (APM)
form2Routes.patch("/:id/approve", requireRole("APM"), async (c) => {
  const { id } = c.req.param();
  const { approved, remarks } = await c.req.json<{ approved: boolean; remarks?: string }>();
  const user = c.get("user");
  const [r] = await db.select().from(f2Header).where(eq(f2Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Submitted") return c.json({ error: "Record not in submitted state" }, 400);

  if (approved) {
    // Process stock movement: deduct from source, add to destination
    const items = await db.select().from(f2Items).where(eq(f2Items.transferId, id));
    for (const item of items) {
      if ((item.transferQtyKg || 0) > 0 || (item.transferQtyPieces || 0) > 0) {
        const lot = await findLot(db, {
          vdvkCode: item.vdvkCode, commodityCode: item.commodityCode,
          stockType: item.goodsType, facilityCode: r.sentFromFacilityCode,
        });
        if (lot) {
          await deductStock(db, lot, item.transferQtyKg || 0, item.transferQtyPieces || 0, {
            movementType: "OUT", referenceTxnType: "Form2", referenceTxnId: id,
            performedBy: user.userId, remarks: `Form 2 ${r.txnNo} transferred out`,
          });
        }
      }

      // Add to destination
      await addStock(db, {
        vdvkCode: item.vdvkCode, vdvkNameSnapshot: item.vdvkNameSnapshot,
        beneficiaryId: item.beneficiaryId, beneficiaryNameSnapshot: item.beneficiaryNameSnapshot,
        commodityCode: item.commodityCode, commodityNameSnapshot: item.commodityNameSnapshot,
        gradeCode: item.gradeCode, gradeNameSnapshot: item.gradeNameSnapshot,
        stockType: item.goodsType,
        facilityCode: r.sentToFacilityCode, facilityNameSnapshot: r.sentToNameSnapshot,
        unit: item.unit, qtyKg: item.transferQtyKg || 0, qtyPieces: item.transferQtyPieces || 0,
        ratePerKg: item.ratePerKg, ratePerPiece: item.ratePerPiece,
        totalValue: item.totalValue,
        sourceTxnType: "Form2_Received", sourceTxnId: id,
      }, {
        movementType: "IN", referenceTxnType: "Form2_Received", referenceTxnId: id,
        performedBy: user.userId, remarks: `Form 2 ${r.txnNo} received at ${r.sentToNameSnapshot}`,
      });
    }
  }

  await db.update(f2Header).set({
    status: approved ? "Approved" : "Rejected",
    approvalRemarks: remarks || null,
    approvedBy: user.userId, approvedAt: new Date().toISOString(),
  }).where(eq(f2Header.id, id));

  if (!approved) {
    await recordRejection({ formType: "Form2", transactionId: id, data: r, rejectedBy: user.userId, remarks });
  }

  await notifyUser(r.createdBy, {
    type: approved ? "APPROVED" : "REJECTED",
    title: approved ? "Stock transfer approved" : "Stock transfer rejected",
    body: `Form 2 ${r.txnNo} was ${approved ? "approved" : "rejected"}${remarks ? ` — ${remarks}` : ""}`,
    relatedTransactionId: id,
  });

  return c.json({ id, status: approved ? "Approved" : "Rejected" });
});

// LIST
form2Routes.get("/", async (c) => {
  const { status, vdvkCode, page = "1", limit = "20" } = c.req.query();
  const conditions = [];
  if (status) conditions.push(eq(f2Header.status, status as any));
  const rows = await db.select().from(f2Header).where(and(...conditions)).orderBy(desc(f2Header.createdAt)).limit(Number(limit)).offset((Number(page) - 1) * Number(limit));
  return c.json(rows);
});

// GET BY ID
form2Routes.get("/:id", async (c) => {
  const { id } = c.req.param();
  const [h] = await db.select().from(f2Header).where(eq(f2Header.id, id)).limit(1);
  if (!h) return c.json({ error: "Not found" }, 404);
  const items = await db.select().from(f2Items).where(eq(f2Items.transferId, id));
  return c.json({ ...h, items });
});

// UPDATE DRAFT
form2Routes.put("/:id", requireRole("Hub Supervisor", "MPC Supervisor", "Haat Bazaar Supervisor", "VDVK Facility Supervisor"), async (c) => {
  const { id } = c.req.param();
  const body = formSchema.partial().parse(await c.req.json());
  const [r] = await db.select().from(f2Header).where(eq(f2Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Draft") return c.json({ error: "Only drafts can be edited" }, 400);

  const upd: any = { updatedAt: new Date().toISOString() };
  for (const k of ['transferDate', 'sentFromFacilityCode', 'sentFromNameSnapshot', 'sentToFacilityCode', 'sentToNameSnapshot', 'sentBy', 'sentByNameSnapshot', 'vehicleDetails', 'driverName', 'driverMobile', 'overallRemarks']) {
    if ((body as any)[k] !== undefined) upd[k] = (body as any)[k];
  }
  await db.update(f2Header).set(upd).where(eq(f2Header.id, id));

  if (body.items) {
    await db.delete(f2Items).where(eq(f2Items.transferId, id));
    await db.insert(f2Items).values(body.items.map(i => ({ ...i, transferId: id })));
  }
  return c.json({ id, status: "Draft" });
});

form2Routes.delete("/:id", requireRole("Hub Supervisor", "MPC Supervisor", "Haat Bazaar Supervisor", "VDVK Facility Supervisor"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const [r] = await db.select().from(f2Header).where(eq(f2Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.createdBy !== user.userId) return c.json({ error: "Only the creator can delete this record" }, 403);
  if (r.status !== "Draft") return c.json({ error: "Only drafts can be deleted" }, 400);
  await db.delete(f2Items).where(eq(f2Items.transferId, id));
  await db.delete(f2Header).where(eq(f2Header.id, id));
  return c.json({ id, deleted: true });
});

form2Routes.patch("/:id/reopen", requireRole("Hub Supervisor", "MPC Supervisor", "Haat Bazaar Supervisor", "VDVK Facility Supervisor"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const [r] = await db.select().from(f2Header).where(eq(f2Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.createdBy !== user.userId) return c.json({ error: "Only the creator can reopen this record" }, 403);
  if (r.status !== "Rejected") return c.json({ error: "Only rejected records can be reopened" }, 400);
  await db.update(f2Header)
    .set({ status: "Draft", approvalRemarks: null, approvedBy: null, approvedAt: null })
    .where(eq(f2Header.id, id));
  return c.json({ id, status: "Draft" });
});
