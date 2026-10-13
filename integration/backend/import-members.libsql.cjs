#!/usr/bin/env node
/**
 * import-members.libsql.cjs — libSQL/Turso batch loader for VDVK field data.
 *
 * Port of import-members.cjs (the PostgreSQL loader) onto @libsql/client,
 * configured via turso.json / TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
 *
 * Reads the converter output (../data/members-full.csv + members-unmatched.csv,
 * new-vdvk-proposals.csv) and loads members into the VDVK MIS database.
 *
 * Write strategy (Turso-safe): NO long interactive transaction — Turso aborts
 * interactive transactions on stream-idle/lifetime limits, and this link is
 * not stable enough to hold one open across ~30k inserts. Instead each
 * chunked multi-row INSERT auto-commits on its own; a mid-load failure leaves
 * a partial load that the NEXT run heals automatically, because the identity
 * pre-checks are re-read from the database (aadhaar authoritative, then
 * P:vdvk|name|gender for anonymous rows). beneficiary_count recompute and the
 * migration_log entry run only after every insert succeeded.
 *
 * Identity dedupe (same rule as the converter):
 *   - aadhaar is authoritative: a fresh aadhaar always queues the row, even
 *     when the same (vdvk, name, gender) already exists (multi-entry lists
 *     allow the same name with different aadhaars);
 *   - rows WITHOUT an aadhaar fall back to the P:vdvk|name|gender key.
 *
 * Usage:
 *   node --max-old-space-size=4096 import-members.libsql.cjs [options]
 *
 *   --dry-run                plan + referential validation, writes NOTHING
 *   --status=Draft|Approved  member status (default: Draft)
 *   --create-missing-vdvk    create VDVKs listed in new-vdvk-proposals.csv with
 *                            inReport=yes (sanctioned by the Member Wise report)
 *                            and load their quarantined rows too
 *   --file=<path>            members CSV (default: ../data/members-full.csv)
 *   --batch=<n>              rows per progress report (default: 500)
 *   --created-by=<userId>    created_by / migrated_by (default: USER-MDA)
 *
 * Deltas vs the Postgres loader (see backend/CHANGES.md):
 *  - @libsql/client, auto-commit chunked writes (no session_replication_role)
 *  - booleans bound as 0/1; information_schema → pragma_table_info
 *  - `= ANY(?)` → `IN (...)`, `count(*)::int` → `count(*)`
 *  - multi-row VALUES chunked at ~10k bound args per statement
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { connect, bind } = require("./turso-client.cjs");

// ─── args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const has = (name) => args.includes(`--${name}`);
const DRY = has("dry-run");
const CREATE_MISSING = has("create-missing-vdvk");
const STATUS = opt("status", "Draft");
const BATCH = Math.max(10, parseInt(opt("batch", "500"), 10) || 500);
const CREATED_BY = opt("created-by", "USER-MDA");
const HERE = __dirname;
const DATA_DIR = path.resolve(HERE, "..", "data");
const MEMBERS_CSV = path.resolve(opt("file", path.join(DATA_DIR, "members-full.csv")));

if (!["Draft", "Approved"].includes(STATUS)) {
  console.error(`--status must be Draft or Approved (got "${STATUS}")`);
  process.exit(1);
}

// ─── tiny CSV parser (quote aware) ──────────────────────────────────────────
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function readCsvObjects(file) {
  const rows = parseCSV(fs.readFileSync(file, "utf8"));
  if (!rows.length) return [];
  const hdr = rows[0];
  return rows.slice(1)
    .filter((r) => r.length === hdr.length)
    .map((r) => Object.fromEntries(hdr.map((h, i) => [h, r[i]])));
}

// converter's norm() — must match for identity pre-checks
const norm = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// ─── column mapping (CSV field → beneficiaries column) ──────────────────────
const BASE_MAP = {
  vdvkcode: "vdvk_code", name: "name", age: "age", gender: "gender",
  mobile: "mobile", aadhaar: "aadhaar", address: "address",
  state: "state", district: "district", mandal: "mandal",
  village: "village", pincode: "pin_code", category: "category",
  hasincomplete: "has_incomplete_details",
};
// extended columns — inserted only when the schema extension has been applied
const EXT_MAP = {
  refrenceid: "reference_id", dob: "date_of_birth", shgname: "shg_name",
  tribe: "tribe", education: "education", occupation: "occupation",
  bankname: "bank_name", ifsc: "ifsc", accountno: "account_number",
  financialyear: "financial_year", grampanchayat: "gram_panchayat",
  flags: "import_flags", sourcefile: "source_file",
  sourcesheet: "source_sheet", proposedvdvkraw: "proposed_vdvk",
};
// columns the loader fills itself (not from CSV values)
const SYNTHETIC = new Set([
  "id", "vdvk_code", "registration_mode", "status",
  "approved_by", "approved_at", "created_by", "created_at", "updated_at",
]);
const GENDERS = ["Male", "Female", "Other"];
const CATEGORIES = ["SC", "ST", "OBC", "General", "Minority", "Others"];

function coerce(dbCol, raw) {
  const v = raw === undefined || raw === null ? "" : String(raw).trim();
  switch (dbCol) {
    case "age": {
      if (!v) return null;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= 120 ? Math.round(n) : null;
    }
    case "gender": return GENDERS.includes(v) ? v : null;
    case "category": return CATEGORIES.includes(v) ? v : null;
    case "has_incomplete_details": return v === "true" || v === "1" || v === "yes";
    default: return v === "" ? null : v;
  }
}
function newId() {
  return "BEN-" + crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
}

const MAX_ARGS = 10000; // per-statement bound-argument ceiling (SQLite allows 32766)

// one safe retry for server-side lock errors (statement not executed);
// anything else fails fast — a re-run heals partial loads via identity dedupe
async function exec1(db, sql, sqlArgs, what) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.execute({ sql, args: sqlArgs.map(bind) });
    } catch (e) {
      const msg = String(e && e.message);
      if (attempt === 1 && /BUSY|database is locked/i.test(msg)) {
        console.log(`  transient lock on ${what} — retrying once...`);
        continue;
      }
      console.error(`\nFAILED on ${what}: ${msg.split("\n")[0]}`);
      console.error("Partial load (if any) is safe — re-run this command to resume; identity dedupe skips what is already committed.");
      throw e;
    }
  }
}

// ─── main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`=== VDVK member loader (libsql) ${DRY ? "(DRY RUN — plan only, no writes)" : "(LIVE)"} ===`);

  if (!fs.existsSync(MEMBERS_CSV)) {
    console.error(`ERROR: ${MEMBERS_CSV} not found. Run tools/convert-members.mjs first.`);
    process.exit(1);
  }

  const db = connect();

  try {
    // ══ phase 0 — read-only introspection ═══════════════════════════════════
    const benCols = new Set(
      (await db.execute({ sql: "SELECT name FROM pragma_table_info('beneficiaries')" }))
        .rows.map((r) => r.name)
    );
    const extAvailable = Object.entries(EXT_MAP).filter(([, db]) => benCols.has(db));
    const extMissing = Object.entries(EXT_MAP).filter(([, db]) => !benCols.has(db));
    if (extMissing.length) {
      console.log(`NOTE: ${extMissing.length} extension columns missing — their values are skipped.`);
      console.log("      Run apply-extension-libsql.cjs first for full data.");
    }

    const vdvkRows = (await db.execute(
      "SELECT code, name, scheme_code, state, district, mandal, pin_code, created_by FROM vdvks"
    )).rows;
    const vdvkByCode = new Map(vdvkRows.map((v) => [v.code, v]));
    const existingAad = new Set(
      (await db.execute("SELECT aadhaar FROM beneficiaries WHERE aadhaar IS NOT NULL")).rows.map((r) => r.aadhaar)
    );
    const existingName = new Set();
    for (const r of (await db.execute("SELECT vdvk_code, name, gender FROM beneficiaries")).rows) {
      existingName.add("P:" + r.vdvk_code + "|" + norm(r.name) + "|" + (r.gender || ""));
    }
    console.log(`existing: ${vdvkByCode.size} VDVKs, ${existingAad.size} aadhaar, ${existingName.size} name identities`);

    const vdvkCommodities = new Map();
    for (const r of (await db.execute("SELECT vdvk_code, commodity_code FROM vdvk_commodities")).rows) {
      if (!vdvkCommodities.has(r.vdvk_code)) vdvkCommodities.set(r.vdvk_code, []);
      vdvkCommodities.get(r.vdvk_code).push(r.commodity_code);
    }
    const commodityCodes = new Set(
      (await db.execute("SELECT code FROM commodities")).rows.map((r) => r.code)
    );

    // ══ phase 1 — pure-JS plan (CSV + dedupe + row assembly) ════════════════
    // 1a: decide sanctioned-but-missing VDVKs (inserts happen in phase 2)
    const planCreates = []; // { ..., insert: bool }
    const proposalsFile = path.join(DATA_DIR, "new-vdvk-proposals.csv");
    if (CREATE_MISSING && fs.existsSync(proposalsFile)) {
      const proposals = readCsvObjects(proposalsFile).filter(
        (p) => String(p.inReport).toLowerCase() === "yes"
      );
      let nextNum =
        Math.max(
          0,
          ...[...vdvkByCode.keys()]
            .map((code) => (/^VDK-(\d+)$/.test(code) ? Number(code.slice(4)) : 0))
        ) + 1;
      for (const p of proposals) {
        const mandal = (p.mandal || "").trim();
        if (!/^MND-\d+$/.test(mandal)) {
          console.log(`SKIP create: "${p.proposedValue}" — no valid mandal (${p.mandal || "?"})`);
          continue;
        }
        const name = (
          (p.suggestedName || "").trim() ||
          p.proposedValue.trim() + (/vdvk/i.test(p.proposedValue) ? "" : " VDVK")
        ).toUpperCase();
        const clash = vdvkRows.find((v) => v.mandal === mandal && norm(v.name) === norm(name));
        if (clash) {
          // already created by a previous (partial) run — reuse it so its
          // quarantined rows still map, but don't insert again
          console.log(`REUSE: "${name}" already exists as ${clash.code}`);
          planCreates.push({ ...clash, proposedValue: p.proposedValue, insert: false });
          continue;
        }
        const template = vdvkRows.find((v) => v.mandal === mandal);
        const code = `VDK-${String(nextNum++).padStart(3, "0")}`;
        const state = template?.state || "Andhra Pradesh";
        const district = template?.district || "Alluri Sitarama Raju";
        const v = {
          code, name, mandal, proposedValue: p.proposedValue, state, district,
          scheme_code: template?.scheme_code || "SCH-001",
          pin_code: template?.pin_code || null,
          created_by: template?.created_by || CREATED_BY,
          insert: true,
        };
        planCreates.push(v);
        vdvkByCode.set(code, v);
        console.log(`CREATE(plan): ${code} ${name} (${mandal}) — sanctioned by Member Wise report`);
      }
    }

    // 1b: assemble insert column list (synthetic columns must be explicit —
    // created_by/status have no DB default and the loader fills them)
    const cols = [
      "id", "registration_mode", "status", "approved_by", "approved_at",
      "created_by", "created_at", "updated_at",
      ...Object.values(BASE_MAP), ...extAvailable.map(([, db]) => db),
    ].filter((db) => SYNTHETIC.has(db) || benCols.has(db));
    const dbToCsv = {
      ...Object.fromEntries(Object.entries(BASE_MAP).map(([c, d]) => [d, c])),
      ...Object.fromEntries(extAvailable.map(([csv, dbCol]) => [dbCol, csv])),
    };

    const stats = { read: 0, queued: 0, skipAadhaar: 0, skipName: 0, skipBlank: 0, badVdvk: 0, quarantined: 0 };
    const perVdvk = new Map();
    const insertRows = [];
    const now = new Date().toISOString();
    const approvedAt = STATUS === "Approved" ? now : null;

    const buildValues = (rec, id, vdvk, extState, extDistrict, extMandal) =>
      cols.map((db) => {
        switch (db) {
          case "id": return id;
          case "registration_mode": return "Bulk";
          case "status": return STATUS;
          case "approved_by": return STATUS === "Approved" ? CREATED_BY : null;
          case "approved_at": return approvedAt;
          case "created_by": return CREATED_BY;
          case "created_at": case "updated_at": return now;
          case "vdvk_code": return vdvk.code;
          case "state": return extState || vdvk.state;
          case "district": return extDistrict || vdvk.district;
          case "mandal": return extMandal || vdvk.mandal;
          default: return coerce(db, rec[dbToCsv[db]]);
        }
      });

    const pushMember = (rec, vdvkCode, ext = {}) => {
      stats.read++;
      const vdvk = vdvkByCode.get(vdvkCode);
      if (!vdvk) { stats.badVdvk++; return; }
      const nm = (rec.name || "").trim();
      if (!nm) { stats.skipBlank++; return; }
      const aad = (rec.aadhaar || "").trim();
      const g = (rec.gender || "").trim();
      const gender = GENDERS.includes(g) ? g : "";
      if (aad && existingAad.has(aad)) { stats.skipAadhaar++; return; }
      // aadhaar is authoritative: only rows WITHOUT one fall back to the
      // (vdvk, name, gender) key — same name + different aadhaar = distinct
      // members (multi-entry lists), so they are kept. The key is still
      // registered for every row so later anonymous rows dedupe against it.
      const pKey = "P:" + vdvkCode + "|" + norm(nm) + "|" + gender;
      if (!aad && existingName.has(pKey)) { stats.skipName++; return; }

      const id = newId();
      const row = { values: buildValues(rec, id, vdvk, ext.state, ext.district, ext.mandal), vdvkCode, id };
      insertRows.push(row);
      if (aad) existingAad.add(aad); // protect against in-file duplicates too
      existingName.add(pKey);
      stats.queued++;
      perVdvk.set(vdvkCode, (perVdvk.get(vdvkCode) || 0) + 1);
      return row;
    };

    // 1b-i: main members file
    for (const rec of readCsvObjects(MEMBERS_CSV)) pushMember(rec, rec.vdvkcode || "");

    // 1b-ii: quarantined rows belonging to newly created VDVKs
    const unmatchedFile = path.join(DATA_DIR, "members-unmatched.csv");
    if (planCreates.length && fs.existsSync(unmatchedFile)) {
      const byProposal = new Map(planCreates.map((v) => [norm(v.proposedValue), v]));
      for (const rec of readCsvObjects(unmatchedFile)) {
        const target = byProposal.get(norm(rec.proposedValue));
        if (!target) { stats.quarantined++; continue; }
        const row = pushMember(rec, target.code, {
          state: target.state, district: target.district, mandal: target.mandal,
        });
        if (row) {
          const i = cols.indexOf("import_flags");
          if (i >= 0) row.values[i] = `missing-vdvk-created:${target.code}`;
          const sf = cols.indexOf("source_file");
          if (sf >= 0) row.values[sf] = rec.file || null;
          const ss = cols.indexOf("source_sheet");
          if (ss >= 0) row.values[ss] = rec.sheet || null;
          const pv = cols.indexOf("proposed_vdvk");
          if (pv >= 0) row.values[pv] = rec.proposedValue || null;
        }
      }
    }

    console.log(
      `plan: read ${stats.read}, to insert ${stats.queued}\n` +
        `      skip: ${stats.skipAadhaar} aadhaar-exists, ${stats.skipName} name-exists, ` +
        `${stats.skipBlank} blank-name, ${stats.badVdvk} unknown-vdvk, ${stats.quarantined} still-quarantined`
    );

    // ── referential pre-checks (dry-run validation) ─────────────────────────
    const unknownCmds = new Set();
    for (const r of insertRows) {
      for (const cmd of vdvkCommodities.get(r.vdvkCode) || []) {
        if (!commodityCodes.has(cmd)) unknownCmds.add(cmd);
      }
    }
    const problems = [];
    if (stats.badVdvk) problems.push(`${stats.badVdvk} rows reference unknown VDVK codes`);
    if (unknownCmds.size) problems.push(`commodity codes missing from commodities: ${[...unknownCmds].join(", ")}`);
    if (extMissing.length) problems.push(`${extMissing.length} extension columns missing (values will be skipped)`);
    if (problems.length) {
      console.log("validation problems:\n  - " + problems.join("\n  - "));
    } else {
      console.log("validation: vdvk codes ✓  commodity codes ✓  extension columns ✓");
    }

    // ── helpers: chunked multi-row statements ───────────────────────────────
    const buildMulti = (head, rows) => {
      const stmts = [];
      if (!rows.length) return stmts;
      const nCols = rows[0].length;
      const maxRows = Math.max(1, Math.floor(MAX_ARGS / nCols));
      for (let i = 0; i < rows.length; i += maxRows) {
        const chunk = rows.slice(i, i + maxRows);
        const ph = chunk.map(() => `(${Array(nCols).fill("?").join(",")})`).join(",");
        stmts.push({ sql: `${head} VALUES ${ph}`, args: chunk.flat() });
      }
      return stmts;
    };

    if (DRY) {
      console.log("\nDRY RUN — nothing written. Run without --dry-run to load.");
      db.close();
      return;
    }

    // ══ phase 2 — write (auto-commit statements; partial loads resume safely) ═
    let inserted = 0;
    for (const v of planCreates.filter((v) => v.insert)) {
      await exec1(db,
        "INSERT INTO vdvks (code,scheme_code,name,state,district,mandal,pin_code,beneficiary_count,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,0,?,?,?)",
        [v.code, v.scheme_code, v.name, v.state, v.district, v.mandal, v.pin_code, v.created_by, now, now],
        `create ${v.code}`);
      console.log(`CREATE: ${v.code} ${v.name} (${v.mandal})`);
    }

    const memberStmts = buildMulti(`INSERT INTO beneficiaries (${cols.join(",")})`, insertRows.map((r) => r.values));
    for (const s of memberStmts) {
      const res = await exec1(db, s.sql, s.args, "insert members");
      inserted += res.rowsAffected;
      process.stdout.write(`  inserted ${inserted}/${insertRows.length}...\r`);
    }
    if (insertRows.length) process.stdout.write(`  inserted ${inserted}/${insertRows.length}...   \n`);

    // beneficiary → commodity (mirror seed: each member gets the VDVK's commodities)
    const benCmdRows = [];
    for (const r of insertRows) {
      for (const cmd of vdvkCommodities.get(r.vdvkCode) || []) {
        benCmdRows.push([r.id, cmd, now]);
      }
    }
    let cmdInserted = 0;
    for (const s of buildMulti("INSERT INTO beneficiary_commodities (beneficiary_id, commodity_code, created_at)", benCmdRows)) {
      cmdInserted += (await exec1(db, s.sql, s.args, "insert commodity maps")).rowsAffected;
    }
    if (cmdInserted) console.log(`commodity mappings: ${cmdInserted}`);

    // recompute beneficiary_count for touched VDVKs (authoritative, not incremental)
    const touched = [...perVdvk.keys()];
    if (touched.length) {
      const ph = touched.map(() => "?").join(",");
      await exec1(db,
        "UPDATE vdvks SET beneficiary_count = " +
          "(SELECT count(*) FROM beneficiaries b WHERE b.vdvk_code = vdvks.code AND b.status <> 'Rejected') " +
          `WHERE code IN (${ph})`,
        touched,
        "recompute beneficiary_count");
      console.log(`beneficiary_count recomputed for ${touched.length} VDVKs`);
    }

    // migration_log
    await exec1(db,
      "INSERT INTO migration_log (entity, record_count, migrated_by, source_file, remarks, created_at) VALUES ('beneficiaries', ?, ?, ?, ?, ?)",
      [inserted, CREATED_BY, path.basename(MEMBERS_CSV),
        `field-data integration import; status=${STATUS}; ${planCreates.length} vdvks created; loader=import-members.libsql.cjs`,
        now],
      "migration_log");

    console.log(`\nDONE — inserted ${inserted} members across ${perVdvk.size} VDVKs.`);

    // ══ phase 3 — verification (read-only) ═══════════════════════════════════
    const [{ total }] = (await db.execute("SELECT count(*) AS total FROM beneficiaries")).rows;
    console.log(`verify: beneficiaries total = ${total}`);
    if (planCreates.length) {
      console.log("created/reused VDVKs:");
      for (const v of planCreates) {
        const [{ n }] = (await db.execute({
          sql: "SELECT count(*) AS n FROM beneficiaries WHERE vdvk_code = ?",
          args: [v.code],
        })).rows;
        console.log(`  ${v.code} ${v.name.padEnd(28)} members=${n}`);
      }
    }
    const top = (await db.execute(
      "SELECT code, name, beneficiary_count FROM vdvks ORDER BY beneficiary_count DESC LIMIT 5"
    )).rows;
    console.log("top loaded: " + top.map((r) => `${r.code}=${r.beneficiary_count}`).join(", "));
  } catch (e) {
    console.error("\nERROR:", (e && e.message ? e.message : String(e)).split("\n")[0]);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
