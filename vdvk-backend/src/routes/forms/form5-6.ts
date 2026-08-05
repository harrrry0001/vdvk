import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { db } from "../../db/index.js";
import { vdvks, beneficiaries, vdvkCommodities, beneficiaryCommodities } from "../../db/schema/master/vdvk-beneficiary.js";
import { requireRole, HonoEnv} from "../../middleware/auth.js";
import { notifyRole, notifyUser } from "../../lib/notify.js";
import { recordRejection } from "../../lib/rejection.js";
import { parseCSV } from "../../lib/csv.js";
import { eq, and, desc, sql } from "drizzle-orm";

// ═══════════════════════════════════════════════════════════════════════════
// FORM 5: VDVK REGISTRATION (Admin/MDA → DPM)
// ═══════════════════════════════════════════════════════════════════════════
export const form5Routes = new Hono<HonoEnv>();

const vdvkSchema = z.object({
  schemeCode: z.string(), name: z.string(),
  state: z.string().default("Andhra Pradesh"), district: z.string().default("Alluri Sitarama Raju"),
  mandal: z.string().optional(), village: z.string().optional(), pinCode: z.string().optional(),
  sanctionDate: z.string().optional(),
  amountSanctioned: z.number().optional(), amountReleased: z.number().optional(),
  bankName: z.string().optional(), accountNumber: z.string().optional(), ifsc: z.string().optional(),
  commodities: z.array(z.string()).optional(),
});

form5Routes.post("/", requireRole("Admin", "MDA"), async (c) => {
  const body = vdvkSchema.parse(await c.req.json());
  const user = c.get("user");
  const code = `VDK-${uuid().slice(0, 4).toUpperCase()}`;
  const now = new Date().toISOString();

  await db.insert(vdvks).values({
    code, schemeCode: body.schemeCode, name: body.name,
    state: body.state, district: body.district, mandal: body.mandal,
    village: body.village, pinCode: body.pinCode,
    sanctionDate: body.sanctionDate,
    amountSanctioned: body.amountSanctioned, amountReleased: body.amountReleased,
    bankName: body.bankName, accountNumber: body.accountNumber, ifsc: body.ifsc,
    beneficiaryCount: 0,
    status: "Draft", createdBy: user.userId,
    createdAt: now, updatedAt: now,
  });

  if (body.commodities?.length) {
    await db.insert(vdvkCommodities).values(
      body.commodities.map(c => ({ vdvkCode: code, commodityCode: c }))
    );
  }
  return c.json({ code, status: "Draft" }, 201);
});

form5Routes.patch("/:code/submit", requireRole("Admin", "MDA"), async (c) => {
  const { code } = c.req.param();
  const [r] = await db.select().from(vdvks).where(eq(vdvks.code, code)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Draft") return c.json({ error: "Only draft VDVKs can be submitted" }, 400);
  // Require at least 1 beneficiary (or explicit skip)
  if (r.beneficiaryCount === 0) return c.json({ error: "Add at least one beneficiary or confirm skip before submitting" }, 400);

  await db.update(vdvks).set({ status: "Pending Approval" }).where(eq(vdvks.code, code));
  await notifyRole("DPM", {
    type: "SUBMITTED", title: "VDVK registration submitted",
    body: `Form 5 ${r.code} (${r.name}) awaits approval`,
    relatedTransactionId: code,
  });
  return c.json({ code, status: "Pending Approval" });
});

form5Routes.patch("/:code/approve", requireRole("DPM"), async (c) => {
  const { code } = c.req.param();
  const { approved, remarks } = await c.req.json<{ approved: boolean; remarks?: string }>();
  const user = c.get("user");
  const [r] = await db.select().from(vdvks).where(eq(vdvks.code, code)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Pending Approval") return c.json({ error: "Not pending approval" }, 400);

  await db.update(vdvks).set({
    status: approved ? "Approved" : "Rejected",
    approvalRemarks: remarks || null, approvedBy: user.userId, approvedAt: new Date().toISOString(),
  }).where(eq(vdvks.code, code));

  if (!approved) {
    await recordRejection({ formType: "Form5", transactionId: code, data: r, rejectedBy: user.userId, remarks });
  }

  await notifyUser(r.createdBy, {
    type: approved ? "APPROVED" : "REJECTED",
    title: approved ? "VDVK registration approved" : "VDVK registration rejected",
    body: `VDVK ${r.code} (${r.name}) was ${approved ? "approved" : "rejected"}${remarks ? ` — ${remarks}` : ""}`,
    relatedTransactionId: code,
  });

  return c.json({ code, status: approved ? "Approved" : "Rejected" });
});

form5Routes.patch("/:code/reopen", requireRole("Admin", "MDA"), async (c) => {
  const { code } = c.req.param();
  const user = c.get("user");
  const [r] = await db.select().from(vdvks).where(eq(vdvks.code, code)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.createdBy !== user.userId) return c.json({ error: "Only the creator can reopen this record" }, 403);
  if (r.status !== "Rejected") return c.json({ error: "Only rejected records can be reopened" }, 400);
  await db.update(vdvks)
    .set({ status: "Draft", approvalRemarks: null, approvedBy: null, approvedAt: null })
    .where(eq(vdvks.code, code));
  return c.json({ code, status: "Draft" });
});

form5Routes.get("/", async (c) => {
  const { status, schemeCode, mandal } = c.req.query();
  const conds = status ? [eq(vdvks.status, status as any)] : [eq(vdvks.status, "Approved")];
  if (schemeCode) conds.push(eq(vdvks.schemeCode, schemeCode));
  if (mandal) conds.push(eq(vdvks.mandal, mandal));

  const rows = await db.select().from(vdvks).where(and(...conds)).orderBy(desc(vdvks.createdAt));
  return c.json(rows);
});

form5Routes.get("/:code", async (c) => {
  const { code } = c.req.param();
  const [r] = await db.select().from(vdvks).where(eq(vdvks.code, code)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  const cmds = await db.select().from(vdvkCommodities).where(eq(vdvkCommodities.vdvkCode, code));
  const bens = await db.select().from(beneficiaries).where(eq(beneficiaries.vdvkCode, code));
  return c.json({ ...r, commodities: cmds, beneficiaries: bens });
});

// ═══════════════════════════════════════════════════════════════════════════
// FORM 6: BENEFICIARY REGISTRATION (Admin/MDA → DPM)
// ═══════════════════════════════════════════════════════════════════════════
export const form6Routes = new Hono<HonoEnv>();

const benSchema = z.object({
  vdvkCode: z.string(), name: z.string(),
  age: z.number().optional(), gender: z.enum(["Male", "Female", "Other"]).optional(),
  mobile: z.string().optional(), aadhaar: z.string().optional(),
  address: z.string().optional(),
  state: z.string().optional(), district: z.string().optional(), mandal: z.string(),
  village: z.string().optional(), pinCode: z.string().optional(),
  category: z.enum(["SC", "ST", "OBC", "General", "Minority", "Others"]).optional(),
  commodities: z.array(z.string()).optional(),
  registrationMode: z.enum(["Bulk", "Individual"]).default("Individual"),
});

form6Routes.post("/", requireRole("Admin", "MDA"), async (c) => {
  const body = benSchema.parse(await c.req.json());
  const user = c.get("user");
  const id = `BEN-${uuid().slice(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();

  await db.insert(beneficiaries).values({
    id, vdvkCode: body.vdvkCode, name: body.name,
    age: body.age, gender: body.gender, mobile: body.mobile, aadhaar: body.aadhaar,
    address: body.address, state: body.state, district: body.district, mandal: body.mandal,
    village: body.village, pinCode: body.pinCode, category: body.category,
    registrationMode: body.registrationMode,
    status: "Draft", createdBy: user.userId,
    createdAt: now, updatedAt: now,
  });

  return c.json({ id, status: "Draft" }, 201);
});

// CSV import (multipart file upload)
form6Routes.post("/import", requireRole("Admin", "MDA"), async (c) => {
  const fd = await c.req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return c.json({ error: "Missing file field" }, 400);

  const rows = parseCSV(await file.text());
  if (rows.length < 2) return c.json({ error: "CSV must have a header row and at least one data row" }, 400);

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const user = c.get("user");
  const now = new Date().toISOString();
  const failed: { row: number; errors: string[] }[] = [];
  const perVdvk: Record<string, number> = {};
  const insertRows: any[] = [];

  for (let i = 1; i < rows.length; i++) {
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => { rec[h] = (rows[i][idx] || "").trim(); });
    const errors: string[] = [];
    if (!rec.vdvkcode) errors.push("vdvkCode required");
    if (!rec.name) errors.push("name required");
    if (rec.age && isNaN(Number(rec.age))) errors.push("age must be a number");

    if (errors.length) { failed.push({ row: i + 1, errors }); continue; }

    const commodities = rec.commodities
      ? rec.commodities.split(";").map((s) => s.trim()).filter(Boolean)
      : [];
    const id = `BEN-${uuid().slice(0, 8).toUpperCase()}`;
    insertRows.push({
      id,
      vdvkCode: rec.vdvkcode, name: rec.name,
      age: rec.age ? Number(rec.age) : null,
      gender: rec.gender || null, mobile: rec.mobile || null, aadhaar: rec.aadhaar || null,
      address: rec.address || null, state: rec.state || null, district: rec.district || null,
      mandal: rec.mandal || null, village: rec.village || null, pinCode: rec.pincode || null,
      category: rec.category || null,
      registrationMode: "Bulk", hasIncompleteDetails: true,
      status: "Draft", createdBy: user.userId, createdAt: now, updatedAt: now,
      _commodities: commodities,
    });
    perVdvk[rec.vdvkcode] = (perVdvk[rec.vdvkcode] || 0) + 1;
  }

  if (insertRows.length) {
    const benCommodityRows = insertRows.flatMap((r) =>
      r._commodities.map((code: string) => ({ beneficiaryId: r.id, commodityCode: code }))
    );
    const clean = insertRows.map(({ _commodities, ...rest }) => rest);
    await db.insert(beneficiaries).values(clean);
    if (benCommodityRows.length) await db.insert(beneficiaryCommodities).values(benCommodityRows);

    for (const [vdvkCode, count] of Object.entries(perVdvk)) {
      await db.update(vdvks)
        .set({ beneficiaryCount: sql`${vdvks.beneficiaryCount} + ${count}` })
        .where(eq(vdvks.code, vdvkCode));
    }
  }

  return c.json({ imported: insertRows.length, failed, vdvks: perVdvk }, 201);
});

// Bulk beneficiary upload
form6Routes.post("/bulk", requireRole("Admin", "MDA"), async (c) => {
  const body = await c.req.json<{ vdvkCode: string; beneficiaries: Array<{ name: string; age?: number; gender?: string; mandal: string }> }>();
  const user = c.get("user");
  const now = new Date().toISOString();

  const rows = body.beneficiaries.map((b, i) => ({
    id: `BEN-${uuid().slice(0, 8).toUpperCase()}`,
    vdvkCode: body.vdvkCode,
    name: b.name, age: b.age || null,
    gender: (b.gender as any) || null, mandal: b.mandal,
    registrationMode: "Bulk" as const,
    hasIncompleteDetails: true,
    status: "Draft" as const,
    createdBy: user.userId,
    createdAt: now, updatedAt: now,
  }));

  await db.insert(beneficiaries).values(rows);

  // Update VDVK beneficiary count
  await db.update(vdvks)
    .set({ beneficiaryCount: sql`${vdvks.beneficiaryCount} + ${rows.length}` })
    .where(eq(vdvks.code, body.vdvkCode));

  return c.json({ count: rows.length, ids: rows.map(r => r.id) }, 201);
});

form6Routes.patch("/:id/submit", requireRole("Admin", "MDA"), async (c) => {
  const { id } = c.req.param();
  const [r] = await db.select().from(beneficiaries).where(eq(beneficiaries.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Draft") return c.json({ error: "Only draft records can be submitted" }, 400);

  await db.update(beneficiaries).set({ status: "Pending Approval" }).where(eq(beneficiaries.id, id));
  await notifyRole("DPM", {
    type: "SUBMITTED", title: "Beneficiary registration submitted",
    body: `Form 6 beneficiary ${r.name} awaits approval`,
    relatedTransactionId: id,
  });
  return c.json({ id, status: "Pending Approval" });
});

form6Routes.patch("/:id/approve", requireRole("DPM"), async (c) => {
  const { id } = c.req.param();
  const { approved, remarks } = await c.req.json<{ approved: boolean; remarks?: string }>();
  const user = c.get("user");
  const [r] = await db.select().from(beneficiaries).where(eq(beneficiaries.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.status !== "Pending Approval") return c.json({ error: "Not pending approval" }, 400);

  await db.update(beneficiaries).set({
    status: approved ? "Approved" : "Rejected",
    approvalRemarks: remarks || null, approvedBy: user.userId, approvedAt: new Date().toISOString(),
  }).where(eq(beneficiaries.id, id));

  if (approved) {
    await db.update(vdvks)
      .set({ beneficiaryCount: sql`${vdvks.beneficiaryCount} + 1` })
      .where(eq(vdvks.code, r.vdvkCode));
  } else {
    await recordRejection({ formType: "Form6", transactionId: id, data: r, rejectedBy: user.userId, remarks });
  }

  await notifyUser(r.createdBy, {
    type: approved ? "APPROVED" : "REJECTED",
    title: approved ? "Beneficiary registration approved" : "Beneficiary registration rejected",
    body: `Beneficiary ${r.name} was ${approved ? "approved" : "rejected"}${remarks ? ` — ${remarks}` : ""}`,
    relatedTransactionId: id,
  });

  return c.json({ id, status: approved ? "Approved" : "Rejected" });
});

form6Routes.patch("/:id/reopen", requireRole("Admin", "MDA"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user");
  const [r] = await db.select().from(beneficiaries).where(eq(beneficiaries.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  if (r.createdBy !== user.userId) return c.json({ error: "Only the creator can reopen this record" }, 403);
  if (r.status !== "Rejected") return c.json({ error: "Only rejected records can be reopened" }, 400);
  await db.update(beneficiaries)
    .set({ status: "Draft", approvalRemarks: null, approvedBy: null, approvedAt: null })
    .where(eq(beneficiaries.id, id));
  return c.json({ id, status: "Draft" });
});

form6Routes.get("/", async (c) => {
  const { vdvkCode, status, mandal, page = "1", limit = "50" } = c.req.query();
  const conds = status ? [eq(beneficiaries.status, status as any)] : [eq(beneficiaries.status, "Approved")];
  if (vdvkCode) conds.push(eq(beneficiaries.vdvkCode, vdvkCode));
  if (mandal) conds.push(eq(beneficiaries.mandal, mandal));

  const rows = await db.select().from(beneficiaries).where(and(...conds))
    .orderBy(desc(beneficiaries.createdAt))
    .limit(Number(limit)).offset((Number(page) - 1) * Number(limit));
  return c.json(rows);
});

form6Routes.get("/:id", async (c) => {
  const { id } = c.req.param();
  const [r] = await db.select().from(beneficiaries).where(eq(beneficiaries.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);
  const commodities = await db.select().from(beneficiaryCommodities)
    .where(eq(beneficiaryCommodities.beneficiaryId, id));
  return c.json({ ...r, commodities });
});

form6Routes.put("/:id", requireRole("Admin", "MDA"), async (c) => {
  const { id } = c.req.param();
  const body = benSchema.partial().parse(await c.req.json());
  const [r] = await db.select().from(beneficiaries).where(eq(beneficiaries.id, id)).limit(1);
  if (!r) return c.json({ error: "Not found" }, 404);

  const upd: any = { updatedAt: new Date().toISOString() };
  for (const [k, v] of Object.entries(body)) {
    if (v !== undefined && k !== 'commodities') upd[k] = v;
  }
  await db.update(beneficiaries).set(upd).where(eq(beneficiaries.id, id));

  if (body.commodities) {
    await db.delete(beneficiaryCommodities).where(eq(beneficiaryCommodities.beneficiaryId, id));
    if (body.commodities.length) {
      await db.insert(beneficiaryCommodities).values(
        body.commodities.map(cc => ({ beneficiaryId: id, commodityCode: cc }))
      );
    }
  }
  return c.json({ id });
});
