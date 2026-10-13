/**
 * import-beneficiaries.route.ts — hardened bulk member import (MDA).
 *
 * Add to the repo as:  src/routes/import/beneficiaries.ts
 * Mount in src/app.ts: app.route("/api/import/beneficiaries", beneficiaryImportRoutes);
 *
 * Hardening vs. the existing form6 /import (see CHANGES.md):
 *   • whole import runs in ONE transaction (partial imports impossible)
 *   • per-row try/catch — one malformed row cannot abort the upload
 *   • Aadhaar + (vdvk,name,gender) duplicate detection against DB *and* within file
 *   • vdvk existence + mandal fallback validation before insert
 *   • row-count / file-size caps
 *   • state/district defaults (dashboard filters on district)
 *   • beneficiary_count RECOMPUTED (not incremented) after import
 *   • migration_log entry for auditability
 *
 * Requires the beneficiaries schema extension (beneficiaries-extension.sql +
 * drizzle schema sync) — column additions listed in CHANGES.md.
 */

import { Hono } from "hono";
import { v4 as uuid } from "uuid";
import { db } from "../../db/index.js";
import {
  beneficiaries,
  beneficiaryCommodities,
  vdvks,
  vdvkCommodities,
} from "../../db/schema/master/vdvk-beneficiary.js";
import { migrationLog } from "../../db/schema/shared/audit-notification.js";
import { requireRole, HonoEnv } from "../../middleware/auth.js";
import { parseCSV } from "../../lib/csv.js";
import { eq, sql, inArray } from "drizzle-orm";

export const beneficiaryImportRoutes = new Hono<HonoEnv>();

const DEFAULTS = { state: "Andhra Pradesh", district: "Alluri Sitarama Raju" };
const MAX_ROWS = 60000;
const MAX_BYTES = 25 * 1024 * 1024;
const BATCH = 500;
const GENDERS = ["Male", "Female", "Other"];
const CATEGORIES = ["SC", "ST", "OBC", "General", "Minority", "Others"];

const norm = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const num = (v: string, lo: number, hi: number) => {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : null;
};

// mirror of the offline loader's identity key: same person re-listed across
// district copies collapses to one row (Aadhaar is authoritative when present)
function identityKeys(rec: Record<string, string>, vdvkCode: string) {
  const gender = GENDERS.includes(rec.gender) ? rec.gender : "";
  return {
    aadhaar: rec.aadhaar && /^\d{12}$/.test(rec.aadhaar) ? rec.aadhaar : null,
    nameKey: "P:" + vdvkCode + "|" + norm(rec.name) + "|" + gender,
  };
}

async function recomputeBeneficiaryCount(tx: any, codes: string[]) {
  for (const code of codes) {
    await tx
      .update(vdvks)
      .set({
        beneficiaryCount: sql`(SELECT count(*) FROM beneficiaries WHERE vdvk_code = ${code} AND status <> 'Rejected')`,
      })
      .where(eq(vdvks.code, code));
  }
}

beneficiaryImportRoutes.post("/", requireRole("MDA"), async (c) => {
  try {
    const fd = await c.req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) return c.json({ error: "Missing file field" }, 400);
    if (file.size > MAX_BYTES) return c.json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024}MB)` }, 400);

    const rows = parseCSV(await file.text());
    if (rows.length < 2) return c.json({ error: "CSV must have a header row and at least one data row" }, 400);
    if (rows.length - 1 > MAX_ROWS) return c.json({ error: `Too many rows (max ${MAX_ROWS})` }, 400);

    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const user = c.get("user");
    const now = new Date().toISOString();

    // ── parse + validate rows (per-row try/catch: collect failures, keep going)
    const failed: { row: number; errors: string[] }[] = [];
    const parsed: { row: number; rec: Record<string, string> }[] = [];
    for (let i = 1; i < rows.length; i++) {
      try {
        const rec: Record<string, string> = {};
        headers.forEach((h, idx) => { rec[h] = (rows[i][idx] || "").trim(); });

        const errors: string[] = [];
        if (!rec.vdvkcode) errors.push("vdvkcode required");
        if (!rec.name) errors.push("name required");
        if (rec.age && (num(rec.age, 0, 120) === null)) errors.push("age must be 0-120");
        if (rec.gender && !GENDERS.includes(rec.gender)) errors.push(`gender must be ${GENDERS.join("/")}`);
        if (rec.category && !CATEGORIES.includes(rec.category)) errors.push(`category must be ${CATEGORIES.join("/")}`);
        if (rec.aadhaar && !/^\d{12}$/.test(rec.aadhaar)) errors.push("aadhaar must be 12 digits");

        if (errors.length) failed.push({ row: i + 1, errors });
        else parsed.push({ row: i + 1, rec });
      } catch (e: any) {
        failed.push({ row: i + 1, errors: [String(e?.message || e).slice(0, 200)] });
      }
    }

    // ── vdvk lookup (existence + mandal/state/district defaults)
    const codes = [...new Set(parsed.map((p) => p.rec.vdvkcode))];
    const vdvkRows = codes.length
      ? await db.select().from(vdvks).where(inArray(vdvks.code, codes))
      : [];
    const vdvkByCode = new Map(vdvkRows.map((v) => [v.code, v]));
    const withUnknown = parsed.filter((p) => !vdvkByCode.has(p.rec.vdvkcode));
    for (const p of withUnknown) failed.push({ row: p.row, errors: [`unknown vdvkcode ${p.rec.vdvkcode}`] });
    const valid = parsed.filter((p) => vdvkByCode.has(p.rec.vdvkcode));

    // ── duplicate detection: DB + within-file
    const submittedAad = [...new Set(valid.map((p) => identityKeys(p.rec, p.rec.vdvkcode).aadhaar).filter(Boolean))] as string[];
    const dbAad = new Set<string>();
    for (let i = 0; i < submittedAad.length; i += 5000) {
      const chunk = submittedAad.slice(i, i + 5000);
      const r = await db.select({ aadhaar: beneficiaries.aadhaar })
        .from(beneficiaries).where(inArray(beneficiaries.aadhaar, chunk));
      r.forEach((x) => dbAad.add(x.aadhaar as string));
    }
    const dbNameKeys = new Set<string>();
    if (valid.length) {
      const r = await db.select({
        vdvkCode: beneficiaries.vdvkCode, name: beneficiaries.name, gender: beneficiaries.gender,
      }).from(beneficiaries).where(inArray(beneficiaries.vdvkCode, codes));
      for (const x of r) {
        dbNameKeys.add("P:" + x.vdvkCode + "|" + norm(x.name) + "|" + (GENDERS.includes(x.gender ?? "") ? x.gender : ""));
      }
    }

    const insertRows: any[] = [];
    const fileAad = new Set<string>();
    const fileKeys = new Set<string>();
    let skippedDuplicates = 0;
    for (const p of valid) {
      try {
        const vdvk = vdvkByCode.get(p.rec.vdvkcode)!;
        const { aadhaar, nameKey } = identityKeys(p.rec, p.rec.vdvkcode);
        if ((aadhaar && (dbAad.has(aadhaar) || fileAad.has(aadhaar))) || dbNameKeys.has(nameKey) || fileKeys.has(nameKey)) {
          skippedDuplicates++;
          continue;
        }
        if (aadhaar) fileAad.add(aadhaar);
        fileKeys.add(nameKey);

        insertRows.push({
          id: `BEN-${uuid().replace(/-/g, "").slice(0, 16).toUpperCase()}`,
          vdvkCode: p.rec.vdvkcode,
          name: p.rec.name,
          age: num(p.rec.age, 0, 120),
          gender: p.rec.gender || null,
          mobile: p.rec.mobile || null,
          aadhaar: aadhaar,
          address: p.rec.address || null,
          state: p.rec.state || vdvk.state || DEFAULTS.state,
          district: p.rec.district || vdvk.district || DEFAULTS.district,
          mandal: p.rec.mandal || vdvk.mandal,
          village: p.rec.village || null,
          pinCode: p.rec.pincode || null,
          category: p.rec.category || null,
          registrationMode: "Bulk" as const,
          hasIncompleteDetails: true,
          status: "Draft" as const,
          createdBy: user.userId,
          createdAt: now,
          updatedAt: now,
          // extension columns (see CHANGES.md schema block)
          referenceId: p.rec.refrenceid || null,
          dateOfBirth: p.rec.dob || null,
          shgName: p.rec.shgname || null,
          tribe: p.rec.tribe || null,
          education: p.rec.education || null,
          occupation: p.rec.occupation || null,
          bankName: p.rec.bankname || null,
          ifsc: p.rec.ifsc || null,
          accountNumber: p.rec.accountno || null,
          financialYear: p.rec.financialyear || null,
          gramPanchayat: p.rec.grampanchayat || null,
          importFlags: p.rec.flags || null,
          sourceFile: p.rec.sourcefile || null,
          sourceSheet: p.rec.sourcesheet || null,
          proposedVdvk: p.rec.proposedvdvkraw || null,
        });
      } catch (e: any) {
        failed.push({ row: p.row, errors: [String(e?.message || e).slice(0, 200)] });
      }
    }

    if (!insertRows.length) {
      return c.json({ imported: 0, skippedDuplicates, failed, vdvks: {} }, 200);
    }

    // ── one transaction: members + commodity maps + counts + audit log
    const perVdvk: Record<string, number> = {};
    let logId: number | null = null;
    await db.transaction(async (tx) => {
      for (let i = 0; i < insertRows.length; i += BATCH) {
        const chunk = insertRows.slice(i, i + BATCH);
        await tx.insert(beneficiaries).values(chunk);
        for (const r of chunk) perVdvk[r.vdvkCode] = (perVdvk[r.vdvkCode] || 0) + 1;
      }

      // commodity maps: each member inherits the VDVK's commodities (as seeded)
      const cmdRows: { beneficiaryId: string; commodityCode: string; createdAt: string }[] = [];
      for (const code of Object.keys(perVdvk)) {
        const cmds = await tx.select().from(vdvkCommodities).where(eq(vdvkCommodities.vdvkCode, code));
        for (const r of insertRows.filter((x) => x.vdvkCode === code)) {
          for (const cmd of cmds) {
            cmdRows.push({ beneficiaryId: r.id, commodityCode: cmd.commodityCode, createdAt: now });
          }
        }
      }
      for (let i = 0; i < cmdRows.length; i += BATCH) {
        await tx.insert(beneficiaryCommodities).values(cmdRows.slice(i, i + BATCH));
      }

      await recomputeBeneficiaryCount(tx, Object.keys(perVdvk));

      const [log] = await tx.insert(migrationLog).values({
        entity: "beneficiaries",
        recordCount: insertRows.length,
        migratedBy: user.userId,
        sourceFile: file.name || null,
        remarks: `POST /api/import/beneficiaries; skippedDuplicates=${skippedDuplicates}; failed=${failed.length}`,
      }).returning({ id: migrationLog.id });
      logId = log.id;
    });

    return c.json(
      { imported: insertRows.length, skippedDuplicates, failed, vdvks: perVdvk, migrationLogId: logId },
      201
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.split("\n")[0].slice(0, 300) : String(e);
    return c.json({ error: `import failed: ${msg}` }, 500);
  }
});
