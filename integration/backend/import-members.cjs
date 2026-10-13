#!/usr/bin/env node
/**
 * import-members.cjs — offline PostgreSQL batch loader for VDVK field data.
 *
 * Reads the converter output (../data/members-full.csv + members-unmatched.csv,
 * new-vdvk-proposals.csv) and loads members into the VDVK MIS database using the
 * same connection pattern as vdvk-backend/src/db/seed/seed.cjs
 * (pg.Client + ca.pem + session_replication_role = replica, single transaction).
 *
 * Idempotent: rows are skipped when their Aadhaar or their
 * (vdvk, name, gender) identity already exists in the database, so the loader
 * can be re-run safely.
 *
 * Usage:
 *   node --max-old-space-size=4096 import-members.cjs [options]
 *
 *   --dry-run                plan + validate, then ROLLBACK (nothing persisted)
 *   --status=Draft|Approved  member status (default: Draft)
 *   --create-missing-vdvk    create VDVKs listed in new-vdvk-proposals.csv with
 *                            inReport=yes (sanctioned by the Member Wise report)
 *                            and load their quarantined rows too
 *   --file=<path>            members CSV (default: ../data/members-full.csv)
 *   --batch=<n>              insert batch size (default: 500)
 *   --created-by=<userId>    created_by / migrated_by (default: USER-MDA)
 *
 * Requires DATABASE_URL (+ DATABASE_CA_CERT or ca.pem) — falls back to the
 * .env of ../../vdvk-backend automatically.
 */

const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const crypto = require("node:crypto");

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
const BATCH = Math.max(50, parseInt(opt("batch", "500"), 10) || 500);
const CREATED_BY = opt("created-by", "USER-MDA");
const HERE = __dirname;
const DATA_DIR = path.resolve(HERE, "..", "data");
const VDVK_BACKEND = path.resolve(HERE, "..", "..", "vdvk-backend");
const MEMBERS_CSV = path.resolve(opt("file", path.join(DATA_DIR, "members-full.csv")));

if (!["Draft", "Approved"].includes(STATUS)) {
  console.error(`--status must be Draft or Approved (got "${STATUS}")`);
  process.exit(1);
}

// ─── env (.env of vdvk-backend as fallback) ─────────────────────────────────
function loadDotEnv(p) {
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
loadDotEnv(path.join(VDVK_BACKEND, ".env"));

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not set (and no vdvk-backend/.env found).");
  process.exit(1);
}

// ─── pg driver (reuse vdvk-backend's node_modules when run in place) ────────
let pg;
try {
  pg = require("pg");
} catch {
  pg = createRequire(path.join(VDVK_BACKEND, "package.json"))("pg");
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

// ─── main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`=== VDVK member loader ${DRY ? "(DRY RUN — will ROLLBACK)" : "(LIVE)"} ===`);

  if (!fs.existsSync(MEMBERS_CSV)) {
    console.error(`ERROR: ${MEMBERS_CSV} not found. Run tools/convert-members.mjs first.`);
    process.exit(1);
  }

  // SSL resolution: explicit sslmode in the URL wins, then an explicit
  // DATABASE_CA_CERT, then a local ca.pem (Aiven style), else insecure TLS.
  const urlSsl = (process.env.DATABASE_URL.match(/sslmode=(\w+)/) || [])[1];
  let ssl;
  if (urlSsl === "disable") {
    ssl = false;
  } else if (process.env.DATABASE_CA_CERT) {
    const p = path.resolve(process.env.DATABASE_CA_CERT);
    ssl = fs.existsSync(p) ? { ca: fs.readFileSync(p) } : { rejectUnauthorized: false };
  } else {
    const caPath = [path.join(HERE, "ca.pem"), path.join(VDVK_BACKEND, "ca.pem")]
      .map(path.resolve).find((p) => fs.existsSync(p));
    ssl = caPath ? { ca: fs.readFileSync(caPath) } : { rejectUnauthorized: false };
  }

  const c = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl,
    connectionTimeoutMillis: 30000,
  });
  await c.connect();

  const exec = async (sql, params = []) => {
    let i = 0;
    const converted = sql.replace(/\?/g, () => `$${++i}`);
    const res = await c.query(converted, params);
    return res.rows;
  };
  const insertMulti = async (head, rows) => {
    if (!rows.length) return 0;
    let n = 0;
    const values = rows
      .map(() => `(${rows[0].map(() => `$${++n}`).join(",")})`)
      .join(",");
    const res = await c.query(`${head} VALUES ${values}`, rows.flat());
    return res.rowCount;
  };

  await c.query("SET session_replication_role = replica");
  await c.query("BEGIN");

  try {
    // 1 ── introspect: which extension columns exist?
    const benCols = new Set(
      (await c.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'beneficiaries'"
      )).rows.map((r) => r.column_name)
    );
    const extAvailable = Object.entries(EXT_MAP).filter(([, db]) => benCols.has(db));
    const extMissing = Object.entries(EXT_MAP).filter(([, db]) => !benCols.has(db));
    if (extMissing.length) {
      console.log(`NOTE: ${extMissing.length} extension columns missing — their values are skipped.`);
      console.log("      Apply ../backend/beneficiaries-extension.sql first for full data.");
    }

    // 2 ── existing state (idempotent re-runs)
    const vdvkRows = await exec(
      "SELECT code, name, scheme_code, state, district, mandal, pin_code, created_by FROM vdvks"
    );
    const vdvkByCode = new Map(vdvkRows.map((v) => [v.code, v]));
    const existingAad = new Set(
      (await exec("SELECT aadhaar FROM beneficiaries WHERE aadhaar IS NOT NULL")).map((r) => r.aadhaar)
    );
    const existingName = new Set();
    for (const r of await exec("SELECT vdvk_code, name, gender FROM beneficiaries")) {
      existingName.add("P:" + r.vdvk_code + "|" + norm(r.name) + "|" + (r.gender || ""));
    }
    console.log(`existing: ${vdvkByCode.size} VDVKs, ${existingAad.size} aadhaar, ${existingName.size} name identities`);

    const vdvkCommodities = new Map();
    for (const r of await exec("SELECT vdvk_code, commodity_code FROM vdvk_commodities")) {
      if (!vdvkCommodities.has(r.vdvk_code)) vdvkCommodities.set(r.vdvk_code, []);
      vdvkCommodities.get(r.vdvk_code).push(r.commodity_code);
    }

    // 3 ── optional: create sanctioned-but-missing VDVKs
    const createdVdvks = [];
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
          console.log(`SKIP create: "${name}" exists as ${clash.code} — add an alias instead.`);
          continue;
        }
        const template = vdvkRows.find((v) => v.mandal === mandal);
        const code = `VDK-${String(nextNum++).padStart(3, "0")}`;
        const state = template?.state || "Andhra Pradesh";
        const district = template?.district || "Alluri Sitarama Raju";
        await exec(
          "INSERT INTO vdvks (code,scheme_code,name,state,district,mandal,pin_code,beneficiary_count,created_by,created_at,updated_at) " +
            "VALUES (?,?,?,?,?,?,?,0,?,?,?)",
          [
            code, template?.scheme_code || "SCH-001", name, state, district, mandal,
            template?.pin_code || null, template?.created_by || CREATED_BY,
            new Date().toISOString(), new Date().toISOString(),
          ]
        );
        createdVdvks.push({ code, name, mandal, proposedValue: p.proposedValue, state, district });
        vdvkByCode.set(code, {
          code, name, scheme_code: template?.scheme_code || "SCH-001",
          state, district, mandal, pin_code: template?.pin_code || null,
        });
        console.log(`CREATE: ${code} ${name} (${mandal}) — sanctioned by Member Wise report`);
      }
    }

    // 4 ── assemble insert column list (synthetic columns must be explicit —
    // they have no DB default for created_by/status and the loader fills them)
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
    const insertRows = []; // { values: [...], vdvkCode }
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

    // 4a ── main members file
    for (const rec of readCsvObjects(MEMBERS_CSV)) pushMember(rec, rec.vdvkcode || "");

    // 4b ── quarantined rows belonging to newly created VDVKs
    const unmatchedFile = path.join(DATA_DIR, "members-unmatched.csv");
    if (createdVdvks.length && fs.existsSync(unmatchedFile)) {
      const byProposal = new Map(createdVdvks.map((v) => [norm(v.proposedValue), v]));
      for (const rec of readCsvObjects(unmatchedFile)) {
        const target = byProposal.get(norm(rec.proposedValue));
        if (!target) { stats.quarantined++; continue; }
        const row = pushMember(rec, target.code, {
          state: target.state, district: target.district, mandal: target.mandal,
        });
        if (row) {
          // quarantine provenance only exists on this file
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

    // 5 ── insert (batches) + commodity maps
    const head = `INSERT INTO beneficiaries (${cols.join(",")})`;
    let inserted = 0;
    for (let i = 0; i < insertRows.length; i += BATCH) {
      const chunk = insertRows.slice(i, i + BATCH);
      inserted += await insertMulti(head, chunk.map((r) => r.values));
      if (inserted % (BATCH * 10) < BATCH) process.stdout.write(`  inserted ${inserted}...\r`);
    }
    if (insertRows.length) process.stdout.write(`  inserted ${inserted}...   \n`);

    // beneficiary → commodity (mirror seed: each member gets the VDVK's commodities)
    const benCmdRows = [];
    for (const r of insertRows) {
      for (const cmd of vdvkCommodities.get(r.vdvkCode) || []) {
        benCmdRows.push([
          null, // serial id — use default
          r.id,
          cmd,
          now,
        ]);
      }
    }
    // beneficiary_commodities.id is serial: insert without it
    const cmdInserted = await insertMulti(
      "INSERT INTO beneficiary_commodities (beneficiary_id, commodity_code, created_at)",
      benCmdRows.map((r) => r.slice(1))
    );
    if (cmdInserted) console.log(`commodity mappings: ${cmdInserted}`);

    // 6 ── recompute beneficiary_count for touched VDVKs (authoritative, not incremental)
    const touched = [...perVdvk.keys()];
    if (touched.length) {
      await exec(
        "UPDATE vdvks v SET beneficiary_count = " +
          "(SELECT count(*) FROM beneficiaries b WHERE b.vdvk_code = v.code AND b.status <> 'Rejected') " +
          "WHERE v.code = ANY(?)",
        [touched]
      );
      console.log(`beneficiary_count recomputed for ${touched.length} VDVKs`);
    }

    // 7 ── migration_log
    if (!DRY) {
      await exec(
        "INSERT INTO migration_log (entity, record_count, migrated_by, source_file, remarks, created_at) " +
          "VALUES ('beneficiaries', ?, ?, ?, ?, ?)",
        [
          inserted,
          CREATED_BY,
          path.basename(MEMBERS_CSV),
          `field-data integration import; status=${STATUS}; ` +
            `${createdVdvks.length} vdvks created; loader=import-members.cjs`,
          now,
        ]
      );
    }

    if (DRY) {
      await c.query("ROLLBACK");
      console.log("\nDRY RUN — transaction rolled back, nothing persisted.");
    } else {
      await c.query("COMMIT");
      console.log(`\nCOMMIT — inserted ${inserted} members across ${perVdvk.size} VDVKs.`);
    }

    // 8 ── verification
    const [{ total }] = await exec("SELECT count(*)::int AS total FROM beneficiaries");
    console.log(`verify: beneficiaries total = ${total}`);
    if (!DRY) {
      if (createdVdvks.length) {
        console.log("created VDVKs:");
        for (const v of createdVdvks) {
          const [{ n }] = await exec("SELECT count(*)::int AS n FROM beneficiaries WHERE vdvk_code = ?", [v.code]);
          console.log(`  ${v.code} ${v.name.padEnd(28)} members=${n}`);
        }
      }
      const top = await exec(
        "SELECT code, name, beneficiary_count FROM vdvks ORDER BY beneficiary_count DESC LIMIT 5"
      );
      console.log("top loaded: " + top.map((r) => `${r.code}=${r.beneficiary_count}`).join(", "));
    }
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    console.error("\nERROR:", (e && e.message ? e.message : String(e)).split("\n")[0]);
    process.exitCode = 1;
  } finally {
    await c.query("SET session_replication_role = origin").catch(() => {});
    await c.end().catch(() => {});
  }
}

main();
