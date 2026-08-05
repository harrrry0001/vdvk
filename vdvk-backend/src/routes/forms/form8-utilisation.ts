import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { db } from "../../db/index.js";
import { form8Utilisation as f8Header, form8UtilisationItems as f8Items } from "../../db/schema/transaction/form8-utilisation.js";
import { requireRole, HonoEnv} from "../../middleware/auth.js";
import { notifyRole, notifyUser } from "../../lib/notify.js";
import { recordRejection } from "../../lib/rejection.js";
import { eq, and, desc } from "drizzle-orm";

export const form8Routes = new Hono<HonoEnv>();
const txnPrefix = "MU";

const itemSchema = z.object({
  locationType: z.enum(["Hub", "Collection Centre", "Haat Bazaar"]),
  facilityCode: z.string().optional(), facilityNameSnapshot: z.string(),
  vdvkCode: z.string().optional(), vdvkNameSnapshot: z.string().optional(),
  mandal: z.string().optional(),
  machineryId: z.string(), machineryNameSnapshot: z.string(),
  commodityCode: z.string(), commodityNameSnapshot: z.string(),
  unit: z.enum(["Kg", "Pieces", "Both"]),
  rawQtyKg: z.number().nullable(), rawQtyPcs: z.number().nullable(),
  packetDetails: z.string().nullable(),
  finalOutputKg: z.number().nullable(), finalOutputPcs: z.number().nullable(),
  utilisationHours: z.number().nullable(), remarks: z.string().nullable().optional(),
  form3ReferenceId: z.string().nullable().optional(),
});

const formSchema = z.object({
  processingDate: z.string(), overallRemarks: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

function calcYield(item: any) {
  return {
    yieldLossKg: (item.rawQtyKg || 0) - (item.finalOutputKg || 0),
    yieldLossPcs: (item.rawQtyPcs || 0) - (item.finalOutputPcs || 0),
  };
}

form8Routes.post("/", requireRole("Hub Supervisor", "Multipurpose Centre Supervisor", "Haat Bazaar Supervisor", "VDVK Facility Supervisor"), async (c) => {
  const body = formSchema.parse(await c.req.json());
  const user = c.get("user");
  const id = uuid(); const txnNo = `${txnPrefix}-${Date.now().toString(36).toUpperCase()}`;

  await db.insert(f8Header).values({
    id, txnNo, processingDate: body.processingDate, overallRemarks: body.overallRemarks,
    createdBy: user.userId, createdByRoleSnapshot: user.activeRole,
  });

  for (const item of body.items) {
    const y = calcYield(item);
    await db.insert(f8Items).values({
      utilisationId: id, ...item, ...y,
    });
  }
  return c.json({ id, txnNo, status: "Draft" }, 201);
});

form8Routes.patch("/:id/submit", requireRole("Hub Supervisor", "Multipurpose Centre Supervisor", "Haat Bazaar Supervisor", "VDVK Facility Supervisor"), async (c) => {
  const { id } = c.req.param();
  const [r] = await db.select().from(f8Header).where(eq(f8Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Draft") return c.json({ error: "Only drafts can be submitted" }, 400);
  await db.update(f8Header).set({ status: "Submitted", submittedAt: new Date().toISOString() }).where(eq(f8Header.id, id));
  await notifyRole("APM", {
    type: "SUBMITTED", title: "Utilisation form submitted",
    body: `Form 8 ${r.txnNo} awaits verification`,
    relatedTransactionId: id,
  });
  return c.json({ id, status: "Submitted" });
});

form8Routes.patch("/:id/verify", requireRole("APM"), async (c) => {
  const { id } = c.req.param();
  const { verified, remarks } = await c.req.json<{ verified: boolean; remarks?: string }>();
  const user = c.get("user");
  const [r] = await db.select().from(f8Header).where(eq(f8Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Submitted") return c.json({ error: "Record not submitted" }, 400);

  await db.update(f8Header).set({
    status: verified ? "Verified" : "Rejected",
    verificationRemarks: remarks || null, verifiedBy: user.userId, verifiedAt: new Date().toISOString(),
  }).where(eq(f8Header.id, id));

  if (!verified) {
    await recordRejection({ formType: "Form8", transactionId: id, data: r, rejectedBy: user.userId, remarks });
  }

  await notifyUser(r.createdBy, {
    type: verified ? "VERIFIED" : "REJECTED",
    title: verified ? "Utilisation form verified" : "Utilisation form rejected",
    body: `Form 8 ${r.txnNo} was ${verified ? "verified" : "rejected"}${remarks ? ` — ${remarks}` : ""}`,
    relatedTransactionId: id,
  });

  return c.json({ id, status: verified ? "Verified" : "Rejected" });
});

form8Routes.get("/", async (c) => {
  const { status, page = "1", limit = "20" } = c.req.query();
  const cond = status ? [eq(f8Header.status, status as any)] : [];
  const rows = await db.select().from(f8Header).where(and(...cond)).orderBy(desc(f8Header.createdAt)).limit(Number(limit)).offset((Number(page) - 1) * Number(limit));
  return c.json(rows);
});

form8Routes.get("/:id", async (c) => {
  const { id } = c.req.param();
  const [h] = await db.select().from(f8Header).where(eq(f8Header.id, id)).limit(1);
  if (!h) return c.json({ error: "Not found" }, 404);
  const items = await db.select().from(f8Items).where(eq(f8Items.utilisationId, id));
  return c.json({ ...h, items });
});

form8Routes.put("/:id", requireRole("Hub Supervisor", "Multipurpose Centre Supervisor", "Haat Bazaar Supervisor", "VDVK Facility Supervisor"), async (c) => {
  const { id } = c.req.param();
  const body = formSchema.partial().parse(await c.req.json());
  const [r] = await db.select().from(f8Header).where(eq(f8Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Draft") return c.json({ error: "Only drafts can be edited" }, 400);

  const upd: any = { updatedAt: new Date().toISOString() };
  if (body.processingDate) upd.processingDate = body.processingDate;
  if (body.overallRemarks !== undefined) upd.overallRemarks = body.overallRemarks;
  await db.update(f8Header).set(upd).where(eq(f8Header.id, id));

  if (body.items) {
    await db.delete(f8Items).where(eq(f8Items.utilisationId, id));
    for (const item of body.items) {
      const y = calcYield(item);
      await db.insert(f8Items).values({ utilisationId: id, ...item, ...y });
    }
  }
  return c.json({ id, status: "Draft" });
});

form8Routes.delete("/:id", requireRole("Hub Supervisor", "Multipurpose Centre Supervisor", "Haat Bazaar Supervisor", "VDVK Facility Supervisor"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const [r] = await db.select().from(f8Header).where(eq(f8Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.createdBy !== user.userId) return c.json({ error: "Only the creator can delete this record" }, 403);
  if (r.status !== "Draft") return c.json({ error: "Only drafts can be deleted" }, 400);
  await db.delete(f8Items).where(eq(f8Items.utilisationId, id));
  await db.delete(f8Header).where(eq(f8Header.id, id));
  return c.json({ id, deleted: true });
});

form8Routes.patch("/:id/reopen", requireRole("Hub Supervisor", "Multipurpose Centre Supervisor", "Haat Bazaar Supervisor", "VDVK Facility Supervisor"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const [r] = await db.select().from(f8Header).where(eq(f8Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.createdBy !== user.userId) return c.json({ error: "Only the creator can reopen this record" }, 403);
  if (r.status !== "Rejected") return c.json({ error: "Only rejected records can be reopened" }, 400);
  await db.update(f8Header)
    .set({ status: "Draft", verificationRemarks: null, verifiedBy: null, verifiedAt: null })
    .where(eq(f8Header.id, id));
  return c.json({ id, status: "Draft" });
});
