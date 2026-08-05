import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import bcrypt from "bcryptjs";
import { db } from "../../db/index.js";
import { parseCSV } from "../../lib/csv.js";
import { migrationLog } from "../../db/schema/shared/audit-notification.js";
import { commodities, grades } from "../../db/schema/master/commodity-grade-rate.js";
import { schemes } from "../../db/schema/master/scheme-exphead-customer-supplier.js";
import { vdvks } from "../../db/schema/master/vdvk-beneficiary.js";
import { users, userRoles, USER_ROLES } from "../../db/schema/master/user.js";
import { requireRole, HonoEnv } from "../../middleware/auth.js";
import { eq, and, desc } from "drizzle-orm";

export const importRoutes = new Hono<HonoEnv>();

const DEFAULTS = {
  state: "Andhra Pradesh",
  district: "Alluri Sitarama Raju",
  password: "Vdvk@2025",
};

interface ParsedCsv {
  file: File;
  headers: string[];
  rows: string[][];
}

async function csvFromReq(c: any): Promise<ParsedCsv> {
  const fd = await c.req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) {
    const e: any = new Error("Missing file field");
    e.status = 400;
    throw e;
  }
  const rows = parseCSV(await file.text());
  if (rows.length < 2) {
    const e: any = new Error("CSV must have a header row and at least one data row");
    e.status = 400;
    throw e;
  }
  return { file, headers: rows[0].map((h) => h.trim().toLowerCase()), rows };
}

function rowMap(headers: string[], cells: string[]): Record<string, string> {
  const rec: Record<string, string> = {};
  headers.forEach((h, idx) => { rec[h] = (cells[idx] || "").trim(); });
  return rec;
}

async function logMigration(userId: string, entity: string, recordCount: number, sourceFile?: string, remarks?: string) {
  const [row] = await db.insert(migrationLog).values({
    entity, recordCount, migratedBy: userId,
    sourceFile: sourceFile || null, remarks: remarks || null,
  }).returning({ id: migrationLog.id });
  return row.id;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message.split("\n")[0].slice(0, 200) : String(e);
}

// ─── COMMODITIES ─────────────────────────────────────────────────────────
importRoutes.post("/commodities", requireRole("Admin", "MDA"), async (c) => {
  const user = c.get("user");
  const { file, headers, rows } = await csvFromReq(c);
  const now = new Date().toISOString();
  const failed: { row: number; errors: string[] }[] = [];
  let imported = 0;

  for (let i = 1; i < rows.length; i++) {
    const rec = rowMap(headers, rows[i]);
    const errors: string[] = [];
    if (!rec.code) errors.push("code required");
    if (!rec.name) errors.push("name required");
    const unit = rec.defaultunit || rec.unit;
    if (!unit) errors.push("defaultUnit required");
    if (errors.length) { failed.push({ row: i + 1, errors }); continue; }
    try {
      await db.insert(commodities).values({
        code: rec.code, name: rec.name, defaultUnit: unit,
        unitEffectiveFrom: rec.uniteffectivefrom || rec.unit_effective_from || now.slice(0, 10),
        status: rec.status || "Active",
        createdAt: now, updatedAt: now,
      });
      imported++;
    } catch (e) {
      failed.push({ row: i + 1, errors: [errorMessage(e)] });
    }
  }

  const logId = await logMigration(user.userId, "commodities", imported, file.name, `${failed.length} row(s) failed`);
  return c.json({ imported, failed, logId }, 201);
});

// ─── GRADES ──────────────────────────────────────────────────────────────
importRoutes.post("/grades", requireRole("Admin", "MDA"), async (c) => {
  const user = c.get("user");
  const { file, headers, rows } = await csvFromReq(c);
  const now = new Date().toISOString();
  const failed: { row: number; errors: string[] }[] = [];
  let imported = 0;

  const knownCommodities = new Set(
    (await db.select({ code: commodities.code }).from(commodities)).map((r) => r.code)
  );

  for (let i = 1; i < rows.length; i++) {
    const rec = rowMap(headers, rows[i]);
    const errors: string[] = [];
    if (!rec.code) errors.push("code required");
    if (!rec.commoditycode) errors.push("commodityCode required");
    if (rec.commoditycode && !knownCommodities.has(rec.commoditycode)) errors.push(`unknown commodityCode ${rec.commoditycode}`);
    if (!rec.gradename) errors.push("gradeName required");
    if (errors.length) { failed.push({ row: i + 1, errors }); continue; }
    try {
      await db.insert(grades).values({
        code: rec.code, commodityCode: rec.commoditycode, gradeName: rec.gradename,
        effectiveFrom: rec.effectivefrom || now.slice(0, 10),
        status: rec.status || "Active",
        createdAt: now,
      });
      imported++;
    } catch (e) {
      failed.push({ row: i + 1, errors: [errorMessage(e)] });
    }
  }

  const logId = await logMigration(user.userId, "grades", imported, file.name, `${failed.length} row(s) failed`);
  return c.json({ imported, failed, logId }, 201);
});

// ─── VDVKS ───────────────────────────────────────────────────────────────
importRoutes.post("/vdvks", requireRole("Admin", "MDA"), async (c) => {
  const user = c.get("user");
  const { file, headers, rows } = await csvFromReq(c);
  const now = new Date().toISOString();
  const failed: { row: number; errors: string[] }[] = [];
  let imported = 0;

  const knownSchemes = new Set(
    (await db.select({ code: schemes.code }).from(schemes)).map((r) => r.code)
  );

  for (let i = 1; i < rows.length; i++) {
    const rec = rowMap(headers, rows[i]);
    const errors: string[] = [];
    if (!rec.code) errors.push("code required");
    if (!rec.schemecode) errors.push("schemeCode required");
    if (rec.schemecode && !knownSchemes.has(rec.schemecode)) errors.push(`unknown schemeCode ${rec.schemecode}`);
    if (!rec.name) errors.push("name required");
    if (errors.length) { failed.push({ row: i + 1, errors }); continue; }
    try {
      await db.insert(vdvks).values({
        code: rec.code, schemeCode: rec.schemecode, name: rec.name,
        state: rec.state || DEFAULTS.state, district: rec.district || DEFAULTS.district,
        mandal: rec.mandal || null, village: rec.village || null, pinCode: rec.pincode || null,
        sanctionDate: rec.sanctiondate || null,
        amountSanctioned: rec.amountsanctioned ? Number(rec.amountsanctioned) : null,
        amountReleased: rec.amountreleased ? Number(rec.amountreleased) : null,
        bankName: rec.bankname || null, accountNumber: rec.accountnumber || null, ifsc: rec.ifsc || null,
        status: rec.status || "Approved", createdBy: user.userId,
        createdAt: now, updatedAt: now,
      });
      imported++;
    } catch (e) {
      failed.push({ row: i + 1, errors: [errorMessage(e)] });
    }
  }

  const logId = await logMigration(user.userId, "vdvks", imported, file.name, `${failed.length} row(s) failed`);
  return c.json({ imported, failed, logId }, 201);
});

// ─── USERS ───────────────────────────────────────────────────────────────
importRoutes.post("/users", requireRole("Admin", "MDA"), async (c) => {
  const user = c.get("user");
  const { file, headers, rows } = await csvFromReq(c);
  const now = new Date().toISOString();
  const failed: { row: number; errors: string[] }[] = [];
  let imported = 0;

  const existingUsernames = new Set(
    (await db.select({ username: users.username }).from(users)).map((r) => r.username.toLowerCase())
  );

  for (let i = 1; i < rows.length; i++) {
    const rec = rowMap(headers, rows[i]);
    const errors: string[] = [];
    if (!rec.name) errors.push("name required");
    if (!rec.username) errors.push("username required");
    else if (existingUsernames.has(rec.username.toLowerCase())) errors.push(`username ${rec.username} already exists`);
    const roles = rec.roles ? rec.roles.split(";").map((s) => s.trim()).filter(Boolean) : ["CC"];
    const invalidRoles = roles.filter((r) => !(USER_ROLES as readonly string[]).includes(r));
    if (invalidRoles.length) errors.push(`invalid role(s): ${invalidRoles.join(", ")}`);
    if (errors.length) { failed.push({ row: i + 1, errors }); continue; }

    const id = `USER-${uuid().slice(0, 8).toUpperCase()}`;
    const pwdHash = await bcrypt.hash(rec.password || DEFAULTS.password, 10);
    try {
      await db.insert(users).values({
        id, name: rec.name, username: rec.username, passwordHash: pwdHash,
        designation: rec.designation || roles[0],
        email: rec.email || null, mobile: rec.mobile || null,
        mandal: rec.mandal || null, vdvkCode: rec.vdvkcode || null, facilityCode: rec.facilitycode || null,
        status: rec.status || "Active",
        createdAt: now, updatedAt: now,
      });
      await db.insert(userRoles).values(roles.map((r, idx) => ({
        userId: id, role: r, isPrimary: idx === 0, assignedFrom: now.slice(0, 10),
      })));
      existingUsernames.add(rec.username.toLowerCase());
      imported++;
    } catch (e) {
      failed.push({ row: i + 1, errors: [errorMessage(e)] });
    }
  }

  const logId = await logMigration(user.userId, "users", imported, file.name, `${failed.length} row(s) failed`);
  return c.json({ imported, failed, logId }, 201);
});

// ─── MIGRATION LOG VIEWER ────────────────────────────────────────────────
importRoutes.get("/logs", requireRole("PO", "DPM", "Admin", "MDA"), async (c) => {
  const { entity, page = "1", limit = "50" } = c.req.query();
  const conds = entity ? [eq(migrationLog.entity, entity as any)] : [];
  const rows = await db.select({
    id: migrationLog.id, entity: migrationLog.entity, recordCount: migrationLog.recordCount,
    migratedBy: migrationLog.migratedBy, sourceFile: migrationLog.sourceFile,
    remarks: migrationLog.remarks, createdAt: migrationLog.createdAt,
  }).from(migrationLog).where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(migrationLog.createdAt))
    .limit(Number(limit)).offset((Number(page) - 1) * Number(limit));
  return c.json(rows);
});
