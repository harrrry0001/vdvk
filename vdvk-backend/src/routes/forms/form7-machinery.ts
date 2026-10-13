import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { db } from "../../db/index.js";
import { machinery as machTable } from "../../db/schema/master/machinery.js";
import { requireRole, HonoEnv} from "../../middleware/auth.js";
import { notifyRole, notifyUser } from "../../lib/notify.js";
import { recordRejection } from "../../lib/rejection.js";
import { eq, and, desc } from "drizzle-orm";

export const form7Routes = new Hono<HonoEnv>();
const txnPrefix = "MACH";

const itemSchema = z.object({
  name: z.string(), commodityMapping: z.array(z.string()),
  currentFacilityCode: z.string().optional(), installationLocation: z.string().optional(),
  currentVdvkCode: z.string().optional(), mandal: z.string(),
  quantity: z.number().default(1), unitCost: z.number(), totalCost: z.number(),
  purchaseDate: z.string(),
  supplierCode: z.string().optional(), supplierNameSnapshot: z.string().optional(),
  supplierContactPerson: z.string().optional(), supplierMobile: z.string().optional(), supplierEmail: z.string().optional(),
  warrantyAvailable: z.boolean().optional(), warrantyType: z.string().optional(), warrantyPeriod: z.string().optional(),
  warrantyStartDate: z.string().optional(), warrantyExpiryDate: z.string().optional(),
  fundingSource: z.string().optional(), reasonPurpose: z.string().optional(),
});

const formSchema = z.object({
  overallRemarks: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

// CREATE (Admin/MDA)
form7Routes.post("/", requireRole("MDA"), async (c) => {
  const body = formSchema.parse(await c.req.json());
  const user = c.get("user");

  const results = [];
  for (const item of body.items) {
    const id = `MACH-${uuid().slice(0, 8).toUpperCase()}`;
    const txnNo = `${txnPrefix}-${Date.now().toString(36).toUpperCase()}`;
    const now = new Date().toISOString();
    await db.insert(machTable).values({
      id, name: item.name,
      commodityMapping: item.commodityMapping,
      currentFacilityCode: item.currentFacilityCode, installationLocation: item.installationLocation as any,
      currentVdvkCode: item.currentVdvkCode, mandal: item.mandal,
      quantity: item.quantity, unitCost: item.unitCost, totalCost: item.totalCost,
      purchaseDate: item.purchaseDate,
      supplierCode: item.supplierCode, supplierNameSnapshot: item.supplierNameSnapshot,
      supplierContactPerson: item.supplierContactPerson, supplierMobile: item.supplierMobile, supplierEmail: item.supplierEmail,
      warrantyAvailable: item.warrantyAvailable, warrantyType: item.warrantyType as any, warrantyPeriod: item.warrantyPeriod,
      warrantyStartDate: item.warrantyStartDate, warrantyExpiryDate: item.warrantyExpiryDate,
      fundingSource: item.fundingSource, reasonPurpose: item.reasonPurpose,
      currentStatus: "Available",
      status: "Draft", createdBy: user.userId,
      createdAt: now, updatedAt: now,
    });
    results.push({ id, txnNo: id, status: "Draft" });
  }
  return c.json(results, 201);
});

// SUBMIT
form7Routes.patch("/:id/submit", requireRole("MDA"), async (c) => {
  const { id } = c.req.param();
  const [r] = await db.select().from(machTable).where(eq(machTable.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Draft") return c.json({ error: "Only draft records can be submitted" }, 400);
  await db.update(machTable).set({ status: "Pending Verification" }).where(eq(machTable.id, id));
  await notifyRole("DPM", {
    type: "SUBMITTED", title: "Machinery registration submitted",
    body: `Form 7 ${r.name} awaits verification`,
    relatedTransactionId: id,
  });
  return c.json({ id, status: "Pending Verification" });
});

// APPROVE / REJECT (DPM)
form7Routes.patch("/:id/approve", requireRole("DPM"), async (c) => {
  const { id } = c.req.param();
  const { approved, remarks } = await c.req.json<{ approved: boolean; remarks?: string }>();
  const user = c.get("user");

  const [r] = await db.select().from(machTable).where(eq(machTable.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Pending Verification") return c.json({ error: "Record not pending verification" }, 400);

  await db.update(machTable).set({
    status: approved ? "Approved" : "Rejected", currentStatus: approved ? "Available" : r.currentStatus,
    approvalRemarks: remarks || null, approvedBy: user.userId, approvedAt: new Date().toISOString(),
  }).where(eq(machTable.id, id));

  if (!approved) {
    await recordRejection({ formType: "Form7", transactionId: id, data: r, rejectedBy: user.userId, remarks });
  }

  await notifyUser(r.createdBy, {
    type: approved ? "APPROVED" : "REJECTED",
    title: approved ? "Machinery registration approved" : "Machinery registration rejected",
    body: `Machinery ${r.name} was ${approved ? "approved" : "rejected"}${remarks ? ` — ${remarks}` : ""}`,
    relatedTransactionId: id,
  });

  return c.json({ id, status: approved ? "Approved" : "Rejected" });
});

form7Routes.patch("/:id/reopen", requireRole("MDA"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const [m] = await db.select().from(machTable).where(eq(machTable.id, id)).limit(1);
  if (!m) return c.json({ error: "Not found" }, 404);
  if (m.createdBy !== user.userId) return c.json({ error: "Only the creator can reopen this record" }, 403);
  if (m.status !== "Rejected") return c.json({ error: "Only rejected records can be reopened" }, 400);
  await db.update(machTable).set({ status: "Draft", approvalRemarks: null }).where(eq(machTable.id, id));
  return c.json({ id, status: "Draft" });
});

// LIST (slim view-model keeps list payloads small)
form7Routes.get("/", async (c) => {
  const { status, facilityCode, page = "1", limit = "20" } = c.req.query();
  const conds = [];
  if (status) conds.push(eq(machTable.currentStatus, status as any));
  if (facilityCode) conds.push(eq(machTable.currentFacilityCode, facilityCode));
  const rows = await db.select({
    id: machTable.id, name: machTable.name, commodityMapping: machTable.commodityMapping,
    currentFacilityCode: machTable.currentFacilityCode, currentVdvkCode: machTable.currentVdvkCode,
    installationLocation: machTable.installationLocation,
    mandal: machTable.mandal, quantity: machTable.quantity,
    unitCost: machTable.unitCost, totalCost: machTable.totalCost, purchaseDate: machTable.purchaseDate,
    supplierNameSnapshot: machTable.supplierNameSnapshot,
    supplierContactPerson: machTable.supplierContactPerson, supplierMobile: machTable.supplierMobile,
    warrantyAvailable: machTable.warrantyAvailable, warrantyExpiryDate: machTable.warrantyExpiryDate,
    lastServiceDate: machTable.lastServiceDate, nextServiceDueDate: machTable.nextServiceDueDate,
    fundingSource: machTable.fundingSource, currentStatus: machTable.currentStatus,
    status: machTable.status, approvedBy: machTable.approvedBy, approvedAt: machTable.approvedAt,
    createdBy: machTable.createdBy, createdAt: machTable.createdAt, updatedAt: machTable.updatedAt,
  }).from(machTable).where(and(...conds)).orderBy(desc(machTable.createdAt)).limit(Number(limit)).offset((Number(page) - 1) * Number(limit));
  return c.json(rows);
});

// GET BY ID
form7Routes.get("/:id", async (c) => {
  const { id } = c.req.param();
  const [r] = await db.select().from(machTable).where(eq(machTable.id, id)).limit(1);
  return r ? c.json(r) : c.json({ error: "Not found" }, 404);
});

// UPDATE DRAFT
form7Routes.put("/:id", requireRole("MDA"), async (c) => {
  const { id } = c.req.param();
  const body = itemSchema.partial().parse(await c.req.json());
  const [r] = await db.select().from(machTable).where(eq(machTable.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Draft") return c.json({ error: "Only draft records can be edited" }, 400);

  const upd: any = { updatedAt: new Date().toISOString() };
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined) {
      if (k === 'commodityMapping' && Array.isArray(v)) (upd as any)[k] = v;
      else if (k === 'warrantyAvailable') (upd as any)[k] = v;
      else (upd as any)[k] = v;
    }
  }
  await db.update(machTable).set(upd).where(eq(machTable.id, id));
  return c.json({ id, status: "Draft" });
});
