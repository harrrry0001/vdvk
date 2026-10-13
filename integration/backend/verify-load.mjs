#!/usr/bin/env node
/**
 * verify-load.mjs — post-load verification of the Turso database against
 * data/coverage-vs-report.csv (the converter's per-VDVK reconciliation with
 * the Member Wise report).
 *
 * Checks:
 *  1. per-VDVK member counts + beneficiary_count consistency
 *  2. totals, status distribution, identity integrity (distinct aadhaar)
 *  3. extension column fill rates (provenance actually persisted)
 *  4. commodity mappings, created/reused VDVKs, migration_log entry
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const cfgPath = path.join(HERE, "turso.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const db = createClient({ url: cfg.url, authToken: cfg.authToken });

const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;
const one = async (sql, args = []) => (await q(sql, args))[0];

// coverage file (quote-aware)
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const covRows = parseCSV(fs.readFileSync(path.join(HERE, "..", "data", "coverage-vs-report.csv"), "utf8"));
const hdr = covRows[0];
const cov = covRows.slice(1).filter((r) => r.length >= hdr.length).map((r) => Object.fromEntries(hdr.map((h, i) => [h, r[i]])));
// proposal rows carry no code — map them to the VDVKs the loader created
const codeByName = new Map(
  (await q("SELECT code, name FROM vdvks")).map((r) => [String(r.name).trim().toUpperCase(), r.code])
);
for (const c of cov) {
  if (!c.code && c.reportName) c.code = codeByName.get(String(c.reportName).trim().toUpperCase()) || c.code;
}

console.log("=== VDVK field-data load verification (Turso) ===\n");

// 1 ── per-VDVK counts
const dbCounts = new Map(
  (await q(`SELECT vdvk_code, count(*) AS n FROM beneficiaries GROUP BY vdvk_code`))
    .map((r) => [r.vdvk_code, Number(r.n)])
);
const countMismatch = [];
const deltas = [];
for (const c of cov) {
  const dbN = dbCounts.get(c.code) || 0;
  const reportN = Number(c.reportCount) || 0;
  if (dbN !== Number(c.loadedCount)) countMismatch.push(`${c.code}: db=${dbN} converter=${c.loadedCount}`);
  deltas.push({ code: c.code, name: c.name, dbN, reportN, delta: dbN - reportN });
}
console.log(`[1] per-VDVK DB vs converter counts: ${countMismatch.length === 0 ? "✓ all match" : "✗ mismatches"}`);
for (const m of countMismatch.slice(0, 12)) console.log(`      ${m}`);
if (countMismatch.length > 12) console.log(`      … ${countMismatch.length - 12} more`);

const zeroVdvks = deltas.filter((d) => d.dbN === 0).map((d) => d.code);
const bigDelta = deltas.filter((d) => Math.abs(d.delta) > 90);
console.log(`\n[2] vs Member Wise report:`);
console.log(`      VDVKs with members: ${deltas.filter((d) => d.dbN > 0).length}/${deltas.length}`);
console.log(`      zero-member VDVKs : ${zeroVdvks.length ? zeroVdvks.join(", ") : "(none)"}`);
console.log(`      |delta| > 90 vs report: ${bigDelta.length}`);
for (const d of bigDelta) console.log(`        ${d.code} ${String(d.name).slice(0, 26).padEnd(26)} db=${d.dbN} report=${d.reportN} delta=${d.delta}`);
const sumDb = deltas.reduce((s, d) => s + d.dbN, 0);
const sumRep = deltas.reduce((s, d) => s + d.reportN, 0);
console.log(`      totals: db=${sumDb} report=${sumRep} delta=${sumDb - sumRep}`);

// 2 ── integrity
const tot = await one(`SELECT count(*) AS n FROM beneficiaries`);
const status = await q(`SELECT status, count(*) AS n FROM beneficiaries GROUP BY status`);
const distinctAad = await one(`SELECT count(DISTINCT aadhaar) AS n FROM beneficiaries WHERE aadhaar IS NOT NULL AND aadhaar <> ''`);
const rowsWithAad = await one(`SELECT count(*) AS n FROM beneficiaries WHERE aadhaar IS NOT NULL AND aadhaar <> ''`);
const benCmd = await one(`SELECT count(*) AS n FROM beneficiary_commodities`);
console.log(`\n[3] integrity:`);
console.log(`      beneficiaries total        : ${tot.n}`);
console.log(`      status                     : ${status.map((s) => `${s.status}=${s.n}`).join(", ")}`);
console.log(`      rows with aadhaar/distinct : ${rowsWithAad.n}/${distinctAad.n} ${rowsWithAad.n === distinctAad.n ? "✓ no duplicate aadhaar" : "✗ DUPLICATES"}`);
console.log(`      beneficiary_commodities    : ${benCmd.n}`);

// count-rule consistency
const badCounts = await q(
  `SELECT v.code, v.beneficiary_count AS stored, (SELECT count(*) FROM beneficiaries b WHERE b.vdvk_code = v.code AND b.status <> 'Rejected') AS actual
     FROM vdvks v WHERE v.beneficiary_count <> (SELECT count(*) FROM beneficiaries b WHERE b.vdvk_code = v.code AND b.status <> 'Rejected')`
);
console.log(`      beneficiary_count rule     : ${badCounts.length === 0 ? "✓ all 108 VDVKs consistent" : `✗ ${badCounts.length} inconsistent`}`);
for (const b of badCounts.slice(0, 5)) console.log(`        ${b.code}: stored=${b.stored} actual=${b.actual}`);

// 3 ── extension fill rates
const extCols = ["reference_id", "date_of_birth", "shg_name", "tribe", "education", "occupation", "bank_name", "ifsc", "account_number", "financial_year", "gram_panchayat", "import_flags", "source_file", "source_sheet", "proposed_vdvk"];
const fills = await one(
  `SELECT ${extCols.map((c) => `sum(CASE WHEN ${c} IS NOT NULL AND ${c} <> '' THEN 1 ELSE 0 END) AS ${c}`).join(", ")} FROM beneficiaries`
);
console.log(`\n[4] extension fill (of ${tot.n} rows):`);
console.log("      " + extCols.map((c) => `${c}=${fills[c]}`).join("  "));

// 4 ── migration log + created VDVKs
const logs = await q(`SELECT * FROM migration_log ORDER BY id DESC LIMIT 3`);
console.log(`\n[5] migration_log:`);
for (const l of logs) console.log(`      #${l.id} ${l.entity} count=${l.record_count} by=${l.migrated_by} file=${l.source_file} @ ${l.created_at}`);
console.log(`        remarks: ${logs[0] && logs[0].remarks}`);

const created = await q(`SELECT code, name, beneficiary_count FROM vdvks WHERE code IN ('VDK-107','VDK-108')`);
console.log(`\n[6] sanctioned VDVKs created by load:`);
for (const c of created) console.log(`      ${c.code} ${c.name} count=${c.beneficiary_count}`);

console.log("\nVerification complete.");
db.close();
