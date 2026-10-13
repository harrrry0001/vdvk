#!/usr/bin/env node
/**
 * import-mfp-baseline.libsql.cjs — loads the ITDA "Operational Status of
 * (JVM) VDVKs" snapshot (VDVK MFP Detials.xls) into vdvk_mfp_baseline.
 *
 * This is HISTORY that predates the MIS ("MFP Collection & Sales Details from
 * the Date of Establishment") — one row per VDVK with dealing products, the
 * field coordinator (CC) name/mobile, and collected/processed/revenue/profit
 * figures. It is deliberately NOT written into stock_ledger or forms: those
 * hold MIS-recorded transactions only.
 *
 * Matching (mandal-scoped, in order):
 *   1. exact alias (MFP_ALIASES below)
 *   2. exact normalized name (case/punctuation/VDVK/FPO-insensitive)
 *   3. unique containment either direction within the same mandal
 *   4. Levenshtein <= 2 within the same mandal (spelling drift: KOTHURU/
 *      KOTTURU, CHOWDUPALLI/COWDUPALLI, ...)
 * Unmatched rows are still stored (vdvk_code = NULL) for review.
 *
 * Quantity cells are free text. Parse rules (raw text always kept):
 *   "300"                 -> 300        parsed
 *   "20000 (500 KGs)"     -> 500        derived   (parenthesised KGs = qty;
 *                                                    the outer number is ₹ value)
 *   "300x15000" / "540x50= 27000" -> 300 / 540    derived (AxB -> A units)
 *   "400 KGs, Coffee"     -> 400        derived
 *   "9 Dindlu, 13400"     -> 9          derived   (number + unit word)
 *   "Adda Leaf"           -> NULL       unparsed  (product name, no figure)
 *   profit "Loss 70800"   -> -70800     derived
 *
 * Idempotent: rows for the same source file are deleted first.
 *
 * Usage:
 *   node import-mfp-baseline.libsql.cjs [--dry-run] [--file=<path>]
 *     (default file: ../VDVK MFP Detials.xls)
 */

const fs = require("node:fs");
const path = require("node:path");
const { connect } = require("./turso-client.cjs");

let XLSX;
try { XLSX = require("xlsx"); }
catch { XLSX = require(path.resolve(__dirname, "..", "tools", "node_modules", "xlsx")); }

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const fileArg = args.find((a) => a.startsWith("--file="));
const SRC = path.resolve(fileArg ? fileArg.slice(7) : path.join(__dirname, "..", "VDVK MFP Detials.xls"));
const SOURCE_FILE = path.basename(SRC);

// ─── manual aliases (MFP spelling -> seeded code) ──────────────────────────
// Keys are normalized (uppercase, alphanumeric only).
const MFP_ALIASES = {
  SADA: "VDK-004",                       // "FPO ANANTHAGIRI SADA VDVK"
  FPOANANTHAGIRISADAVDVK: "VDK-004",
  FPOSUKURUVDVK: "VDK-062",              // "FPO Sukuru VDVK" (Hukumpeta FPO)
  FPOKANDRUM: "VDK-030",                 // "FPO - Kandrum"
  KORRAIKOTHAVALASA: "VDK-029",          // "Korrai - Kothavalasa"
  CHINALABUDUFPOVDVK: "VDK-014",
  // VDK-101 / VDK-103 are the "Pedakodapalli" twins — the file lists both
  // (distinct product lists, same coordinator): full spelling = VDK-101,
  // "(Manyam)" variant = VDK-103.
  PEDAKODAPALLI: "VDK-101",
  PKODAPALLIMANYAM: "VDK-103",
};

// ─── helpers ────────────────────────────────────────────────────────────────
const norm = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const stripTokens = (s) => norm(String(s ?? "").replace(/\b(VDVK|VDVKM|M|FPO|PVTG)\b/g, " "));

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Best-effort quantity parse. Returns { value, status }. */
function parseQty(raw) {
  if (raw === null || raw === undefined || raw === "") return { value: null, status: "unparsed" };
  if (typeof raw === "number") return { value: raw, status: "parsed" };
  const s = String(raw).trim();
  if (s === "" || /^0+(\.0+)?$/.test(s)) return { value: 0, status: "parsed" };
  // plain number
  if (/^-?[\d,]+(\.\d+)?$/.test(s)) return { value: Number(s.replace(/,/g, "")), status: "parsed" };
  // AxB or AxB= C -> A units
  let m = s.match(/^([\d,]+)\s*[xX×]\s*[\d,]+/);
  if (m) return { value: Number(m[1].replace(/,/g, "")), status: "derived" };
  // (N KGs) in parens -> N
  m = s.match(/\(\s*([\d,]+)\s*KG/i);
  if (m) return { value: Number(m[1].replace(/,/g, "")), status: "derived" };
  // number + unit word ("400 KGs", "9 Dindlu")
  m = s.match(/^([\d,]+)\s+[A-Za-z]/);
  if (m) return { value: Number(m[1].replace(/,/g, "")), status: "derived" };
  // leading number with trailing text ("100 KGs, 2000")
  m = s.match(/^([\d,]+)/);
  if (m) return { value: Number(m[1].replace(/,/g, "")), status: "derived" };
  return { value: null, status: "unparsed" };
}

/** Profit may be "Loss 70800". */
function parseMoney(raw) {
  if (raw === null || raw === undefined || raw === "") return { value: null, status: "unparsed" };
  if (typeof raw === "number") return { value: raw, status: "parsed" };
  const s = String(raw).trim();
  if (/^-?[\d,]+(\.\d+)?$/.test(s)) return { value: Number(s.replace(/,/g, "")), status: "parsed" };
  const m = s.match(/Loss\s*([\d,]+)/i);
  if (m) return { value: -Number(m[1].replace(/,/g, "")), status: "derived" };
  const n = s.match(/-?[\d,]+(\.\d+)?/);
  if (n) return { value: Number(n[0].replace(/,/g, "")), status: "derived" };
  return { value: null, status: "unparsed" };
}

// ─── main ───────────────────────────────────────────────────────────────────
(async () => {
  if (!fs.existsSync(SRC)) { console.error(`File not found: ${SRC}`); process.exit(1); }
  const db = connect();

  const vdvkRows = (await db.execute(
    "SELECT v.code, v.name, m.name AS mandal FROM vdvks v LEFT JOIN mandals m ON m.code = v.mandal"
  )).rows;
  const byCode = new Map(vdvkRows.map((r) => [r.code, r]));
  const mandals = [...new Set(vdvkRows.map((r) => String(r.mandal ?? "")))];

  const normMandal = (raw) => {
    const n = norm(raw);
    return mandals.find((m) => norm(m) === n) || mandals.find((m) => norm(m).startsWith(n.slice(0, 8))) || null;
  };

  function matchVdvk(nameRaw, mandalRaw) {
    const mandal = normMandal(mandalRaw);
    const pool = vdvkRows.filter((r) => !mandal || String(r.mandal) === mandal);
    const n = norm(nameRaw);
    const core = stripTokens(nameRaw);
    // 1. alias
    if (MFP_ALIASES[n]) return { code: MFP_ALIASES[n], how: "alias" };
    // 2. exact normalized (full or stripped)
    let hits = pool.filter((r) => norm(r.name) === n || stripTokens(r.name) === core || stripTokens(r.name) === n || norm(r.name) === core);
    if (hits.length === 1) return { code: hits[0].code, how: "exact" };
    // 3. unique containment either direction
    hits = pool.filter((r) => {
      const rn = norm(r.name), rs = stripTokens(r.name);
      return (core.length >= 5 && (rn.includes(core) || rs.includes(core))) ||
             (n.length >= 5 && (rn.includes(n) || rs.includes(n)));
    });
    if (hits.length === 1) return { code: hits[0].code, how: "contains" };
    if (hits.length > 1) {
      // prefer the shortest name (most specific stem match)
      hits.sort((a, b) => norm(a.name).length - norm(b.name).length);
      if (norm(hits[0].name).length !== norm(hits[1].name).length) return { code: hits[0].code, how: "contains-best" };
      return { code: null, how: `ambiguous(${hits.map((h) => h.code).join("/")})` };
    }
    // 4. fuzzy, mandal-scoped
    if (core.length >= 6) {
      let best = null;
      for (const r of pool) {
        const d = lev(core, stripTokens(r.name));
        if (d <= 2 && (!best || d < best.d)) best = { code: r.code, d };
      }
      if (best) return { code: best.code, how: `fuzzy(d${best.d})` };
    }
    return { code: null, how: "unmatched" };
  }

  // read the workbook: rows 4+ (0-based), columns per the report layout
  const wb = XLSX.read(fs.readFileSync(SRC), { type: "buffer", raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

  const records = [];
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => c === null || String(c).trim() === "")) continue;
    const [sl, mandalRaw, nameRaw, products, ccName, ccMobile, collected, processed, revenue, profit] = r;
    if (!nameRaw) continue;
    const m = matchVdvk(nameRaw, mandalRaw);
    const cq = parseQty(collected), pq = parseQty(processed);
    const rev = parseMoney(revenue), pro = parseMoney(profit);
    const statuses = [cq.status, pq.status, rev.status, pro.status];
    const parseStatus = statuses.includes("unparsed") ? (statuses.every((s) => s === "unparsed") ? "unparsed" : "partial") : (statuses.includes("derived") ? "derived" : "parsed");
    records.push({
      sourceRow: i + 1,
      mandalRaw: mandalRaw == null ? null : String(mandalRaw).trim(),
      nameRaw: String(nameRaw).trim(),
      products: products == null ? null : String(products).trim(),
      ccName: ccName == null ? null : String(ccName).trim(),
      ccMobile: ccMobile == null ? null : String(ccMobile).trim(),
      collectedRaw: collected == null ? null : String(collected).trim(),
      processedRaw: processed == null ? null : String(processed).trim(),
      revenueRaw: revenue == null ? null : String(revenue).trim(),
      profitRaw: profit == null ? null : String(profit).trim(),
      collectedQty: cq.value, processedQty: pq.value, revenue: rev.value, profit: pro.value,
      parseStatus,
      vdvkCode: m.code, matchHow: m.how,
    });
  }

  // One baseline row per VDVK: if two source rows resolve to the same code,
  // the stronger match wins (alias/exact > contains > fuzzy); ties go to the
  // earlier row. The loser keeps its source row with vdvk_code = NULL so the
  // double-listing stays visible for review.
  const rank = (x) => (x.matchHow.startsWith("alias") ? 0 : x.matchHow.startsWith("exact") ? 1 : x.matchHow.startsWith("contains") ? 2 : 3);
  const codeOwner = new Map();
  for (const r of records) {
    if (!r.vdvkCode) continue;
    const owner = codeOwner.get(r.vdvkCode);
    if (!owner) { codeOwner.set(r.vdvkCode, r); continue; }
    const rWins = rank(r) < rank(owner) || (rank(r) === rank(owner) && r.sourceRow < owner.sourceRow);
    const loser = rWins ? owner : r;
    const winner = rWins ? r : owner;
    loser.vdvkCode = null;
    loser.matchHow = `duplicate:${winner.vdvkCode}@r${winner.sourceRow}`;
    codeOwner.set(winner.vdvkCode, winner);
  }

  const matched = records.filter((r) => r.vdvkCode).length;
  const howCounts = {};
  for (const r of records) howCounts[r.matchHow] = (howCounts[r.matchHow] || 0) + 1;
  console.log(`read ${records.length} VDVK rows from ${SOURCE_FILE}`);
  console.log(`matched: ${matched}/${records.length}  (${Object.entries(howCounts).map(([k, v]) => `${k}=${v}`).join(", ")})`);
  const unmatched = records.filter((r) => !r.vdvkCode);
  for (const r of unmatched) console.log(`  NO-CODE r${r.sourceRow}: [${r.mandalRaw}] ${r.nameRaw}  (${r.matchHow})`);
  if (args.includes("--verbose")) {
    for (const r of records) {
      const target = r.vdvkCode ? `${r.vdvkCode} ${byCode.get(r.vdvkCode)?.name ?? ""}` : "(none)";
      console.log(`  r${r.sourceRow}\t[${r.mandalRaw}] ${r.nameRaw} -> ${target}  (${r.matchHow})`);
    }
  }

  if (DRY) { console.log("\n--dry-run: nothing written"); return; }

  await db.execute({ sql: "DELETE FROM vdvk_mfp_baseline WHERE source_file = ?", args: [SOURCE_FILE] });
  let inserted = 0;
  for (const r of records) {
    await db.execute({
      sql:
        "INSERT INTO vdvk_mfp_baseline (vdvk_code, vdvk_name_snapshot, mandal_snapshot, dealing_products, cc_name, cc_mobile, " +
        "collected_raw, collected_qty, processed_raw, processed_qty, revenue, profit, parse_status, source_file, source_row) " +
        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args: [r.vdvkCode, r.nameRaw, r.mandalRaw, r.products, r.ccName, r.ccMobile,
        r.collectedRaw, r.collectedQty, r.processedRaw, r.processedQty, r.revenue, r.profit,
        r.parseStatus, SOURCE_FILE, r.sourceRow],
    });
    inserted++;
  }

  const totals = await db.execute(
    "SELECT count(*) rows_, count(vdvk_code) matched, sum(collected_qty) collected, sum(processed_qty) processed, sum(revenue) revenue, sum(profit) profit FROM vdvk_mfp_baseline"
  );
  const t = totals.rows[0];
  console.log(`\ninserted ${inserted} rows`);
  console.log(`baseline totals: matched=${t.matched}/${t.rows_} collected=${t.collected ?? 0} processed=${t.processed ?? 0} revenue=${t.revenue ?? 0} profit=${t.profit ?? 0}`);
})().catch((e) => { console.error(e); process.exit(1); });
