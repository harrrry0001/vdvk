import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { db } from "../../db/index.js";
import { form9Trainings as f9Header, form9TrainingItems as f9Items } from "../../db/schema/transaction/form9-10-12.js";
import { form10FundUtilisation as f10Header, form10ExpenditureItems as f10Items } from "../../db/schema/transaction/form9-10-12.js";
import { form12FieldVisits as f12Header, form12VisitPhotos as f12Photos } from "../../db/schema/transaction/form9-10-12.js";
import { facilities as facTable } from "../../db/schema/master/facility.js";
import { requireRole, HonoEnv} from "../../middleware/auth.js";
import { notifyRole, notifyUser } from "../../lib/notify.js";
import { recordRejection } from "../../lib/rejection.js";
import { eq, and, desc } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════
// FORM 9: TRAINING REGISTER (DPM only, no approval required)
// ═══════════════════════════════════════════════════════════════════════════
export const form9Routes = new Hono<HonoEnv>();
const txnPrefix9 = "TRN";

const trainingItemSchema = z.object({
  vdvkCode: z.string(), vdvkNameSnapshot: z.string(),
  schemeSnapshot: z.string().optional(), mandalSnapshot: z.string().optional(),
  commodityCovered: z.string().optional(),
  numberOfParticipants: z.number(), trainingExpense: z.number().nullable(),
  remarks: z.string().nullable().optional(),
});

const trainingSchema = z.object({
  trainingDate: z.string(), trainingTitle: z.string(),
  trainingTopic: z.string().optional(), trainingType: z.string().optional(),
  trainingVenue: z.string().optional(), resourcePerson: z.string().optional(),
  supportingDocuments: z.array(z.string()).optional(),
  overallRemarks: z.string().optional(),
  items: z.array(trainingItemSchema).min(1),
});

form9Routes.post("/", requireRole("DPM"), async (c) => {
  const body = trainingSchema.parse(await c.req.json());
  const user = c.get("user");
  const id = uuid(); const txnNo = `${txnPrefix9}-${Date.now().toString(36).toUpperCase()}`;

  const totalParticipants = body.items.reduce((s, i) => s + i.numberOfParticipants, 0);
  const totalExpenditure = body.items.reduce((s, i) => s + (i.trainingExpense || 0), 0);

  await db.insert(f9Header).values({
    id, txnNo, trainingDate: body.trainingDate, trainingTitle: body.trainingTitle,
    trainingTopic: body.trainingTopic as any, trainingType: body.trainingType as any,
    trainingVenue: body.trainingVenue, resourcePerson: body.resourcePerson,
    totalParticipants, totalExpenditure,
    supportingDocuments: body.supportingDocuments,
    overallRemarks: body.overallRemarks,
    createdBy: user.userId,
  });

  if (body.items.length > 0) {
    await db.insert(f9Items).values(body.items.map(i => ({ ...i, trainingId: id })));
  }
  return c.json({ id, txnNo }, 201);
});

form9Routes.get("/", async (c) => {
  const { page = "1", limit = "20" } = c.req.query();
  const rows = await db.select().from(f9Header).orderBy(desc(f9Header.trainingDate)).limit(Number(limit)).offset((Number(page) - 1) * Number(limit));
  return c.json(rows);
});

form9Routes.get("/:id", async (c) => {
  const { id } = c.req.param();
  const [h] = await db.select().from(f9Header).where(eq(f9Header.id, id)).limit(1);
  if (!h) return c.json({ error: "Not found" }, 404);
  const items = await db.select().from(f9Items).where(eq(f9Items.trainingId, id));
  return c.json({ ...h, items });
});

form9Routes.put("/:id", requireRole("DPM"), async (c) => {
  const { id } = c.req.param();
  const body = trainingSchema.partial().parse(await c.req.json());
  const [r] = await db.select().from(f9Header).where(eq(f9Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);

  const upd: any = { updatedAt: new Date().toISOString() };
  for (const k of ['trainingDate', 'trainingTitle', 'trainingTopic', 'trainingType', 'trainingVenue', 'resourcePerson', 'overallRemarks']) {
    if ((body as any)[k] !== undefined) upd[k] = (body as any)[k];
  }
  if (body.items) {
    const tp = body.items.reduce((s, i) => s + i.numberOfParticipants, 0);
    const te = body.items.reduce((s, i) => s + (i.trainingExpense || 0), 0);
    upd.totalParticipants = tp; upd.totalExpenditure = te;
  }
  await db.update(f9Header).set(upd).where(eq(f9Header.id, id));

  if (body.items) {
    await db.delete(f9Items).where(eq(f9Items.trainingId, id));
    await db.insert(f9Items).values(body.items.map(i => ({ ...i, trainingId: id })));
  }
  return c.json({ id });
});

form9Routes.delete("/:id", requireRole("DPM"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const [r] = await db.select().from(f9Header).where(eq(f9Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.createdBy !== user.userId) return c.json({ error: "Only the creator can delete this record" }, 403);
  if (r.isDraft !== true) return c.json({ error: "Only drafts can be deleted" }, 400);
  await db.delete(f9Items).where(eq(f9Items.trainingId, id));
  await db.delete(f9Header).where(eq(f9Header.id, id));
  return c.json({ id, deleted: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// FORM 10: WEEKLY FUND UTILISATION (APM → DPM)
// ═══════════════════════════════════════════════════════════════════════════
export const form10Routes = new Hono<HonoEnv>();
const txnPrefix10 = "WFU";

const expItemSchema = z.object({
  expenditureDate: z.string(), expenditureHeadCode: z.string(), expenditureHeadNameSnapshot: z.string(),
  relatedToVdvk: z.boolean(), vdvkCodes: z.array(z.string()).nullable(),
  relatedToLocation: z.boolean(), locationType: z.string().nullable().optional(), locationCodes: z.array(z.string()).nullable(),
  amount: z.number(), purpose: z.string().optional(), schemeSnapshot: z.string().optional(),
  remarks: z.string().nullable().optional(),
});

const fundSchema = z.object({
  weekFrom: z.string(), weekTo: z.string(),
  supportingDocuments: z.array(z.string()).optional(),
  overallRemarks: z.string().optional(),
  items: z.array(expItemSchema).min(1),
});

form10Routes.post("/", requireRole("APM"), async (c) => {
  const body = fundSchema.parse(await c.req.json());
  const user = c.get("user");
  const id = uuid(); const txnNo = `${txnPrefix10}-${Date.now().toString(36).toUpperCase()}`;

  await db.insert(f10Header).values({
    id, txnNo, weekFrom: body.weekFrom, weekTo: body.weekTo,
    supportingDocuments: body.supportingDocuments, overallRemarks: body.overallRemarks,
    createdBy: user.userId,
  });
  if (body.items.length > 0) {
    await db.insert(f10Items).values(body.items.map(i => ({ ...i, utilisationId: id })));
  }
  return c.json({ id, txnNo, status: "Draft" }, 201);
});

form10Routes.patch("/:id/submit", requireRole("APM"), async (c) => {
  const { id } = c.req.param();
  const [r] = await db.select().from(f10Header).where(eq(f10Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  await db.update(f10Header).set({ status: "Submitted", submittedAt: new Date().toISOString() }).where(eq(f10Header.id, id));
  await notifyRole("DPM", {
    type: "SUBMITTED", title: "Fund utilisation submitted",
    body: `Form 10 ${r.txnNo} awaits approval`,
    relatedTransactionId: id,
  });
  return c.json({ id, status: "Submitted" });
});

form10Routes.patch("/:id/approve", requireRole("DPM"), async (c) => {
  const { id } = c.req.param();
  const { approved, remarks } = await c.req.json<{ approved: boolean; remarks?: string }>();
  const user = c.get("user");
  const [r] = await db.select().from(f10Header).where(eq(f10Header.id, id)).limit(1);
  if (!r || r.status !== "Submitted") return c.json({ error: "Not found or not submitted" }, 404);

  await db.update(f10Header).set({
    status: approved ? "Approved" : "Rejected",
    approvalRemarks: remarks || null, approvedBy: user.userId, approvedAt: new Date().toISOString(),
  }).where(eq(f10Header.id, id));

  if (!approved) {
    await recordRejection({ formType: "Form10", transactionId: id, data: r, rejectedBy: user.userId, remarks });
  }

  await notifyUser(r.createdBy, {
    type: approved ? "APPROVED" : "REJECTED",
    title: approved ? "Fund utilisation approved" : "Fund utilisation rejected",
    body: `Form 10 ${r.txnNo} was ${approved ? "approved" : "rejected"}${remarks ? ` — ${remarks}` : ""}`,
    relatedTransactionId: id,
  });

  return c.json({ id, status: approved ? "Approved" : "Rejected" });
});

form10Routes.get("/", async (c) => {
  const { status, page = "1", limit = "20" } = c.req.query();
  const cond = status ? [eq(f10Header.status, status as any)] : [];
  const rows = await db.select().from(f10Header).where(and(...cond)).orderBy(desc(f10Header.weekFrom)).limit(Number(limit)).offset((Number(page) - 1) * Number(limit));
  return c.json(rows);
});

form10Routes.get("/:id", async (c) => {
  const { id } = c.req.param();
  const [h] = await db.select().from(f10Header).where(eq(f10Header.id, id)).limit(1);
  if (!h) return c.json({ error: "Not found" }, 404);
  const items = await db.select().from(f10Items).where(eq(f10Items.utilisationId, id));
  return c.json({ ...h, items });
});

form10Routes.put("/:id", requireRole("APM"), async (c) => {
  const { id } = c.req.param();
  const body = fundSchema.partial().parse(await c.req.json());
  const [r] = await db.select().from(f10Header).where(eq(f10Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Draft") return c.json({ error: "Only drafts can be edited" }, 400);

  const upd: any = { updatedAt: new Date().toISOString() };
  for (const k of ['weekFrom', 'weekTo', 'supportingDocuments', 'overallRemarks']) {
    if ((body as any)[k] !== undefined) upd[k] = (body as any)[k];
  }
  await db.update(f10Header).set(upd).where(eq(f10Header.id, id));

  if (body.items) {
    await db.delete(f10Items).where(eq(f10Items.utilisationId, id));
    await db.insert(f10Items).values(body.items.map(i => ({ ...i, utilisationId: id })));
  }
  return c.json({ id, status: "Draft" });
});

form10Routes.delete("/:id", requireRole("APM"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const [r] = await db.select().from(f10Header).where(eq(f10Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.createdBy !== user.userId) return c.json({ error: "Only the creator can delete this record" }, 403);
  if (r.status !== "Draft") return c.json({ error: "Only drafts can be deleted" }, 400);
  await db.delete(f10Items).where(eq(f10Items.utilisationId, id));
  await db.delete(f10Header).where(eq(f10Header.id, id));
  return c.json({ id, deleted: true });
});

form10Routes.patch("/:id/reopen", requireRole("APM"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const [r] = await db.select().from(f10Header).where(eq(f10Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.createdBy !== user.userId) return c.json({ error: "Only the creator can reopen this record" }, 403);
  if (r.status !== "Rejected") return c.json({ error: "Only rejected records can be reopened" }, 400);
  await db.update(f10Header)
    .set({ status: "Draft", approvalRemarks: null, approvedBy: null, approvedAt: null })
    .where(eq(f10Header.id, id));
  return c.json({ id, status: "Draft" });
});

// ═══════════════════════════════════════════════════════════════════════════
// FORM 11: FACILITY REGISTRATION (Admin → DPM)
// ═══════════════════════════════════════════════════════════════════════════
export const form11Routes = new Hono<HonoEnv>();

form11Routes.post("/", requireRole("Admin", "MDA"), async (c) => {
  const body = await c.req.json();
  const user = c.get("user");
  const code = `FAC-${uuid().slice(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();

  await db.insert(facTable).values({
    code, type: body.type, name: body.name,
    schemeCode: body.schemeCode, state: body.state, district: body.district, mandal: body.mandal,
    village: body.village, address: body.address, pinCode: body.pinCode,
    dateOfEstablishment: body.dateOfEstablishment,
    operationalStatus: (body.operationalStatus || "Operational") as any,
    storageCapacityKg: body.storageCapacityKg, processingCapacityKgPerDay: body.processingCapacityKgPerDay,
    electricityAvailable: body.electricityAvailable, waterFacility: body.waterFacility,
    internetConnectivity: body.internetConnectivity,
    otherInfrastructure: body.otherInfrastructure, machineryAvailable: body.machineryAvailable,
    totalFundSanctioned: body.totalFundSanctioned, totalFundReleased: body.totalFundReleased,
    totalFundUtilised: body.totalFundUtilised,
    balanceFund: (body.totalFundReleased || 0) - (body.totalFundUtilised || 0),
    status: "Draft", createdBy: user.userId,
  });
  return c.json({ code, status: "Draft" }, 201);
});

form11Routes.patch("/:code/submit", requireRole("Admin", "MDA"), async (c) => {
  const { code } = c.req.param();
  const [r] = await db.select().from(facTable).where(eq(facTable.code, code)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Draft") return c.json({ error: "Not a draft" }, 400);
  await db.update(facTable).set({ status: "Pending Approval" }).where(eq(facTable.code, code));
  await notifyRole("DPM", {
    type: "SUBMITTED", title: "Facility registration submitted",
    body: `Form 11 ${r.code} (${r.name}) awaits approval`,
    relatedTransactionId: code,
  });
  return c.json({ code, status: "Pending Approval" });
});

form11Routes.patch("/:code/approve", requireRole("DPM"), async (c) => {
  const { code } = c.req.param();
  const { approved, remarks } = await c.req.json<{ approved: boolean; remarks?: string }>();
  const user = c.get("user");
  const [r] = await db.select().from(facTable).where(eq(facTable.code, code)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);

  await db.update(facTable).set({
    status: approved ? "Approved" : "Rejected",
    approvalRemarks: remarks || null, approvedBy: user.userId, approvedAt: new Date().toISOString(),
  }).where(eq(facTable.code, code));

  if (!approved) {
    await recordRejection({ formType: "Form11", transactionId: code, data: r, rejectedBy: user.userId, remarks });
  }

  await notifyUser(r.createdBy, {
    type: approved ? "APPROVED" : "REJECTED",
    title: approved ? "Facility registration approved" : "Facility registration rejected",
    body: `Facility ${r.code} (${r.name}) was ${approved ? "approved" : "rejected"}${remarks ? ` — ${remarks}` : ""}`,
    relatedTransactionId: code,
  });

  return c.json({ code, status: approved ? "Approved" : "Rejected" });
});

form11Routes.get("/", async (c) => {
  const rows = await db.select().from(facTable).orderBy(desc(facTable.createdAt));
  return c.json(rows);
});

form11Routes.patch("/:code/reopen", requireRole("Admin", "MDA"), async (c) => {
  const { code } = c.req.param();
  const user = c.get("user");
  const [r] = await db.select().from(facTable).where(eq(facTable.code, code)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.createdBy !== user.userId) return c.json({ error: "Only the creator can reopen this record" }, 403);
  if (r.status !== "Rejected") return c.json({ error: "Only rejected records can be reopened" }, 400);
  await db.update(facTable)
    .set({ status: "Draft", approvalRemarks: null, approvedBy: null, approvedAt: null })
    .where(eq(facTable.code, code));
  return c.json({ code, status: "Draft" });
});

form11Routes.get("/:code", async (c) => {
  const { code } = c.req.param();
  const [r] = await db.select().from(facTable).where(eq(facTable.code, code)).limit(1);
  return r ? c.json(r) : c.json({ error: "Not found" }, 404);
});

// ═══════════════════════════════════════════════════════════════════════════
// FORM 12: FIELD VISIT (APM only, no approval)
// ═══════════════════════════════════════════════════════════════════════════
export const form12Routes = new Hono<HonoEnv>();
const txnPrefix12 = "FVS";

const visitSchema = z.object({
  visitDate: z.string(), visitStartTime: z.string(), visitEndTime: z.string().nullable(),
  mandal: z.string(),
  visitLocationType: z.enum(["VDVK", "Hub", "Collection Centre", "Haat Bazaar", "Beneficiary", "Other"]),
  locationName: z.string().nullable(), relatedVdvkCodes: z.array(z.string()).nullable(),
  purposeOfVisit: z.string().nullable(), visitDescription: z.string().nullable(),
  keyObservations: z.string().nullable(),
  gpsLatitude: z.number().nullable(), gpsLongitude: z.number().nullable(),
  supportingDocuments: z.array(z.string()).nullable(),
  remarks: z.string().nullable(),
  photos: z.array(z.object({ photoUrl: z.string(), gpsLatitude: z.number().nullable(), gpsLongitude: z.number().nullable(), capturedAt: z.string().nullable() })).optional(),
});

form12Routes.post("/", requireRole("APM"), async (c) => {
  const body = visitSchema.parse(await c.req.json());
  const user = c.get("user");
  const id = uuid(); const txnNo = `${txnPrefix12}-${Date.now().toString(36).toUpperCase()}`;

  // Editable until midnight IST
  const visitDate = new Date(body.visitDate);
  visitDate.setHours(23, 59, 59, 999);
  const editableUntil = visitDate.toISOString();

  await db.insert(f12Header).values({
    id, txnNo,
    visitDate: body.visitDate, visitStartTime: body.visitStartTime, visitEndTime: body.visitEndTime,
    mandal: body.mandal, visitLocationType: body.visitLocationType, locationName: body.locationName,
    relatedVdvkCodes: body.relatedVdvkCodes, purposeOfVisit: body.purposeOfVisit as any,
    visitDescription: body.visitDescription, keyObservations: body.keyObservations,
    gpsLatitude: body.gpsLatitude, gpsLongitude: body.gpsLongitude,
    photoCount: body.photos?.length || 0,
    supportingDocuments: body.supportingDocuments, remarks: body.remarks,
    editableUntil, createdBy: user.userId, createdByRoleSnapshot: user.activeRole,
  });

  if (body.photos?.length) {
    await db.insert(f12Photos).values(body.photos.map(p => ({ ...p, visitId: id })));
  }
  return c.json({ id, txnNo }, 201);
});

form12Routes.get("/", async (c) => {
  const { mandal, apmId, page = "1", limit = "20" } = c.req.query();
  const conds = [];
  if (mandal) conds.push(eq(f12Header.mandal, mandal));
  if (apmId) conds.push(eq(f12Header.createdBy, apmId));
  const rows = await db.select().from(f12Header).where(and(...conds)).orderBy(desc(f12Header.visitDate)).limit(Number(limit)).offset((Number(page) - 1) * Number(limit));
  return c.json(rows);
});

form12Routes.get("/:id", async (c) => {
  const { id } = c.req.param();
  const [h] = await db.select().from(f12Header).where(eq(f12Header.id, id)).limit(1);
  if (!h) return c.json({ error: "Not found" }, 404);
  const photos = await db.select().from(f12Photos).where(eq(f12Photos.visitId, id));
  return c.json({ ...h, photos });
});

form12Routes.put("/:id", requireRole("APM"), async (c) => {
  const { id } = c.req.param();
  const body = visitSchema.partial().parse(await c.req.json());
  const [r] = await db.select().from(f12Header).where(eq(f12Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (new Date() > new Date(r.editableUntil)) return c.json({ error: "Visit record is no longer editable" }, 403);

  const upd: any = { updatedAt: new Date().toISOString() };
  for (const k of ['visitDate', 'visitStartTime', 'visitEndTime', 'mandal', 'visitLocationType', 'locationName', 'purposeOfVisit', 'visitDescription', 'keyObservations', 'gpsLatitude', 'gpsLongitude', 'remarks']) {
    if ((body as any)[k] !== undefined) upd[k] = (body as any)[k];
  }
  if (body.supportingDocuments) upd.supportingDocuments = body.supportingDocuments;
  if (body.relatedVdvkCodes) upd.relatedVdvkCodes = body.relatedVdvkCodes;
  if (body.photos) upd.photoCount = body.photos.length;

  await db.update(f12Header).set(upd).where(eq(f12Header.id, id));

  if (body.photos) {
    await db.delete(f12Photos).where(eq(f12Photos.visitId, id));
    await db.insert(f12Photos).values(body.photos.map(p => ({ ...p, visitId: id })));
  }
  return c.json({ id });
});

form12Routes.delete("/:id", requireRole("APM"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const [r] = await db.select().from(f12Header).where(eq(f12Header.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.createdBy !== user.userId) return c.json({ error: "Only the creator can delete this record" }, 403);
  if (new Date() > new Date(r.editableUntil)) return c.json({ error: "Visit record is no longer editable" }, 403);
  await db.delete(f12Photos).where(eq(f12Photos.visitId, id));
  await db.delete(f12Header).where(eq(f12Header.id, id));
  return c.json({ id, deleted: true });
});
