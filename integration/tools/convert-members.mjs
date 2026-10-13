// ============================================================================
// convert-members.mjs — VDVK member data -> DB-ready CSVs
//
// Reads every member Excel file extracted under ../data/raw (from the zips in
// "D:\1A Gopal\New folder"), maps each member row onto the VDVK MIS schema
// (beneficiaries table), dedupes globally, and writes:
//
//   ../data/members-import.csv        -> exact contract of POST /forms/form6/import
//   ../data/members-full.csv          -> extended columns for scripts/import-members.cjs
//   ../data/members-unmatched.csv     -> rows that could not be mapped (manual fix)
//   ../data/vdvk-reconciliation.csv   -> every distinct source VDVK name vs seed codes
//   ../data/new-vdvk-proposals.csv    -> sanctioned-in-report / in-source VDVKs missing
//                                        from the seed (loader can create them)
//   ../data/vdvk-master-list.csv      -> seed codes + loaded counts
//   ../data/coverage-vs-report.csv    -> loaded counts vs VDVKs Member Wise Data Report
//   ../data/import-report.md          -> statistics & decisions
//
// VDVK name -> code resolution order (per row):
//   1. scoped alias  ../data/vdvk-aliases.json "file:<x>"/"sheet:<x>"/"village:<x>"
//   2. plain alias   ../data/vdvk-aliases.json {"SADA": "VDK-004"}
//   3. matcher tiers inside mandal context, then globally:
//      exact variant -> token-set -> prefix -> contains ->
//      single-token exact -> single-token fuzzy -> full-string fuzzy
//   Variants normalise: case/punctuation, "(parentheticals)", leading/trailing
//   VDVK/VDVDK/VDVKM(S), FPO substring, sorted token sets.
//   If "Name of Proposed VDVK" is BLANK -> fallback: sheet name, then file name
//   (never for district/mandal-wide workbooks). Present-but-unmatched -> quarantine.
//
// Dedupe: aadhaar key first; otherwise composite name+dob+village+mobile (when
// at least 2 of dob/village/mobile exist). A later matched row SUPERSEDES an
// earlier unmatched occurrence of the same person (and vice versa: matched wins).
// ============================================================================
import { createRequire } from "node:module";
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, basename, extname, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx"); // CJS package: load via require for full API surface
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const RAW_DIR = join(ROOT, "data", "raw");
const OUT_DIR = join(ROOT, "data");
const SEED_PATH = process.env.SEED_FILE || join(ROOT, "..", "vdvk-backend", "src", "db", "seed", "data", "real-data.cjs");
const ALIAS_PATH = join(OUT_DIR, "vdvk-aliases.json");
const REPORT_XLSX = "VDVKs Member Wise Data Report.xlsx";
const CURRENT_YEAR = 2026;

// NOTE: must match `districts` table seeded by seed.cjs
const STATE = "Andhra Pradesh";
const DISTRICT = "Alluri Sitarama Raju";

const SKIP_FILE_TOKENS = [REPORT_XLSX.toLowerCase(), "member wise data report"];

// header of the canonical member export (from the NGO file) — used only for
// headerless continuation sheets (e.g. the VELUGU Pedakodapalli file)
const TEMPLATE_HEADERS = ["Refrence Id", "Name of Tribal", "Gender", "Date of Birth", "Birth Year", "Age", "ID Type", "ID Value", "Mobile Number", "Landline Number", "Is Smart Phone", "Address", "State", "District", "Block", "Grama panchayat", "Village", "Pincode", "Mother", "Father", "Education", "Occupation", "Existing Membership", "Category", "ST Name", "SHG Name", "Bearer Role", "SHG NRLM ID", "SHG Other ID", "Bearer Office", "Vehicle Type", "Bank name", "IFSC Code", "Branch name", "Account No.", "Self / Other", "Self / Other Name", "Household Members", "Household name", "Household Gender", "Household Education", "Household Occupation", "Relationship With Member", "Is Gathering", "Name of Proposed VDVK", "Financial Year", "REMARKS"];

// ---------------------------------------------------------------- seed maps --
const seed = require(SEED_PATH);

const norm = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

function tokensOf(name) {
  return String(name ?? "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
}
/** Normalised matching variants of a VDVK name (all upper, alnum only). */
function variantsOf(name) {
  const out = new Set();
  const bare = String(name ?? "").replace(/\([^)]*\)/g, " "); // drop (parentheticals)
  const n = norm(bare);
  if (n) out.add(n);
  const stripLead = (x) => x.replace(/^(VDVK|VDVDK)+/, "");
  const stripTrail = (x) => x.replace(/(VDVDK|VDVKM|VDVKS|VDVK)$/, "");
  if (n) {
    const s1 = stripTrail(stripLead(n));
    if (s1) out.add(s1);
    const noFpo = n.replace(/FPO/g, "");
    if (noFpo.length >= 5) out.add(noFpo);
    const s2 = stripTrail(stripLead(noFpo));
    if (s2 && s2.length >= 5) out.add(s2);
    const toks = tokensOf(bare);
    const t1 = toks.filter((t) => t !== "VDVK" && t !== "VDVDK");
    if (t1.length > 1) out.add([...t1].sort().join(""));
    const t2 = t1.filter((t) => t !== "FPO");
    if (t2.length >= 1 && t1.length !== t2.length) out.add([...t2].sort().join(""));
  }
  return out;
}

const mandals = seed.mandals.map(([code, name]) => ({ code, name, n: norm(name) }));

const vdvks = seed.vdvks.map((t) => {
  const [code, schemeCode, name, mandalCode, pin, beneficiaryCount] = t;
  const keys = variantsOf(name);
  const tokens = tokensOf(name).filter((t) => t !== "VDVK" && t !== "VDVDK" && t.length >= 6);
  return { code, schemeCode, name, mandalCode, pin, beneficiaryCount, keys, tokens };
});
const vdvkByCode = Object.fromEntries(vdvks.map((v) => [v.code, v]));

// ---------------------------------------------------------------- aliases ----
let aliases = {};
if (existsSync(ALIAS_PATH)) {
  try { aliases = JSON.parse(readFileSync(ALIAS_PATH, "utf8")); } catch (e) { console.error("WARN: bad aliases json: " + e.message); }
}
const plainAlias = new Map(); // normKey -> code
const scopedAlias = []; // { scope, contains, map: Map(normKey -> code) }
for (const [k, v] of Object.entries(aliases)) {
  if (k.startsWith("_")) continue;
  if (v && typeof v === "object") {
    const m = /^(\w+):(.*)$/.exec(k);
    if (!m) { console.error(`WARN: scoped alias key must be file:/sheet:/village: -> ${k}`); continue; }
    const map = new Map();
    for (const [ik, iv] of Object.entries(v)) map.set(ik === "*" ? "*" : norm(ik), iv);
    scopedAlias.push({ scope: m[1], contains: m[2].toUpperCase(), map });
  } else {
    plainAlias.set(norm(k), v);
  }
}
function checkCode(code, key) {
  if (typeof code === "string" && code.startsWith("NEW:")) return; // quarantine target, not a seed code
  if (!vdvkByCode[code]) console.error(`WARN: alias "${key}" points at unknown code ${code}`);
}
for (const [k, v] of plainAlias) checkCode(v, k);

function scopedResolve(rawProposed, scope) {
  for (const s of scopedAlias) {
    const hay = s.scope === "file" ? scope.fileBase : s.scope === "sheet" ? scope.sheetName : s.scope === "village" ? scope.village : "";
    if (!hay || !String(hay).toUpperCase().includes(s.contains)) continue;
    if (!rawProposed) { if (s.map.has("*")) return s.map.get("*"); continue; }
    for (const v of variantsOf(rawProposed)) {
      if (s.map.has(v)) return s.map.get(v);
    }
    if (s.map.has(norm(rawProposed))) return s.map.get(norm(rawProposed));
  }
  return null;
}

function plainAliasResolve(rawName) {
  for (const v of variantsOf(rawName)) {
    const hit = plainAlias.get(v);
    if (hit) return hit;
  }
  const hit = plainAlias.get(norm(rawName));
  return hit || null;
}

// ------------------------------------------------------------ fuzzy match ----
function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** Tiers inside a candidate pool. Returns {vdvk,method} | {error,candidates} | null(=no hit) */
function tryPool(variants, srcTokens, candidates) {
  // 1. exact variant
  let hits = candidates.filter((v) => [...variants].some((x) => v.keys.has(x)));
  if (hits.length === 1) return { vdvk: hits[0], method: "exact" };
  if (hits.length > 1) return { error: "ambiguous-exact", candidates: hits };

  const big = [...variants].filter((v) => v.length >= 5);
  if (!big.length) return null;

  // 2. prefix (either direction, min len 5)
  hits = candidates.filter((v) => [...variants].some((x) => x.length >= 5 && [...v.keys].some((k) => k.startsWith(x) || x.startsWith(k))));
  if (hits.length === 1) return { vdvk: hits[0], method: "prefix" };
  if (hits.length > 1) return { error: "ambiguous-prefix", candidates: hits };

  // 3. contains (min len 5)
  hits = candidates.filter((v) => [...variants].some((x) => x.length >= 5 && [...v.keys].some((k) => k.includes(x) || x.includes(k))));
  if (hits.length === 1) return { vdvk: hits[0], method: "contains" };
  if (hits.length > 1) return { error: "ambiguous-contains", candidates: hits };

  // 4. single-token exact/prefix (tokens >= 6 chars)
  const toks = srcTokens.filter((t) => t.length >= 6);
  if (toks.length) {
    hits = candidates.filter((v) => toks.some((t) => [...v.keys].some((k) => k === t || k.startsWith(t) || t.startsWith(k))));
    if (hits.length === 1) return { vdvk: hits[0], method: "token-exact" };
    if (hits.length > 1) return { error: "ambiguous-token", candidates: hits };
  }

  // 5. single-token fuzzy (maxD 2 for len>=8 else 1) — unique best only
  if (toks.length) {
    const allowed = Math.max(...toks.map((t) => (t.length >= 8 ? 2 : 1)));
    let bestD = 99;
    const hits = [];
    for (const c of candidates) {
      let bd = 99;
      for (const t of toks) {
        for (const ck of c.keys) {
          if (Math.abs(ck.length - t.length) > allowed) continue;
          const d = lev(t, ck);
          if (d < bd) bd = d;
        }
      }
      if (bd <= allowed) {
        if (bd < bestD) { bestD = bd; hits.length = 0; hits.push(c); }
        else if (bd === bestD) hits.push(c);
      }
    }
    if (hits.length === 1) return { vdvk: hits[0], method: `token-fuzzy(d=${bestD})` };
    if (hits.length > 1) return { error: "ambiguous-token-fuzzy", candidates: hits };
  }

  // 6. full-string fuzzy (maxD 2 for len>=6 else 1)
  {
    let bestD = 99, bestAllowed = 0;
    const hits = [];
    for (const c of candidates) {
      let bd = 99, allowed = 0;
      for (const x of variants) {
        const maxD = x.length >= 6 ? 2 : 1;
        for (const k of c.keys) {
          if (Math.abs(k.length - x.length) > maxD) continue;
          const d = lev(x, k);
          if (d < bd) { bd = d; allowed = maxD; }
        }
      }
      if (bd <= allowed) {
        if (bd < bestD) { bestD = bd; bestAllowed = allowed; hits.length = 0; hits.push(c); }
        else if (bd === bestD) hits.push(c);
      }
    }
    if (hits.length === 1) return { vdvk: hits[0], method: `fuzzy(d=${bestD})` };
    if (hits.length > 1) return { error: "ambiguous-fuzzy", candidates: hits };
  }
  return null;
}

/** Resolve a source VDVK name to a seed vdvk. Returns {vdvk, method} or {error, candidates}. */
function matchVdvk(rawName, mandalCode) {
  const alias = plainAliasResolve(rawName);
  if (alias) {
    if (typeof alias === "string" && alias.startsWith("NEW:")) {
      // sanctioned elsewhere / only known by this name — quarantine + proposal
      return { error: "missing-vdvk", newName: alias.slice(4) };
    }
    const v = vdvkByCode[alias];
    if (v) return { vdvk: v, method: "alias" };
    return { error: `alias points at unknown code ${alias}` };
  }
  const variants = variantsOf(rawName);
  if (!variants.size || [...variants].every((v) => v.length < 3)) return { error: "empty" };
  const srcTokens = tokensOf(rawName).filter((t) => t !== "VDVK" && t !== "VDVDK");

  if (mandalCode) {
    const pool = vdvks.filter((v) => v.mandalCode === mandalCode);
    const inCtx = tryPool(variants, srcTokens, pool);
    if (inCtx && inCtx.vdvk) return inCtx;
    const global = tryPool(variants, srcTokens, vdvks);
    if (global && global.vdvk) return { ...global, ctxMismatch: global.vdvk.mandalCode !== mandalCode };
    if (inCtx && inCtx.error) return inCtx;
    if (global && global.error) return global;
    return { error: "unmatched" };
  }
  const r = tryPool(variants, srcTokens, vdvks);
  return r ?? { error: "unmatched" };
}

/** Resolve a free-text place (sheet/folder/block) to a mandal code. */
function mandalFrom(str) {
  const n = norm(str);
  if (!n || n.length < 4) return null;
  let best = null;
  for (const m of mandals) {
    let hit = false;
    if (m.n === n) hit = true;
    else if (n.length >= 5 && (m.n.includes(n) || (n.includes(m.n) && m.n.length >= 5))) hit = true;
    else if (n.length >= 6 && lev(n, m.n) <= 1) hit = true;
    if (hit && (!best || m.n.length > best.n.length)) best = m;
  }
  return best ? best.code : null;
}

// ------------------------------------------------------------ file listing ---
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const DISTRICT_WIDE_TOKENS = [
  "BANGARUMETTA VDVK FINAL", "DEVAPURAM DETA FINAL", "VDVK MINUMULURU FINAL",
  "VDVK RAYIGEDDA DETA FINAL", "RUDAKOTA VDVK MEMBER DATA FINAL",
  "ADUGULA PUTTU VDVK MEMBER WISE DATA FINAL", "VANJANGI VDVDK MEMBER DATA",
  "VANTLAMAMIDI VDVK MEMBER DATA FINAL", "CHODEPALLI VDVK MEMBER DATA FINAL",
  "ANANTHAGIRT MANDAL VDVK MEMBER DATA FINAL",
];

let files = [];
if (existsSync(RAW_DIR)) {
  files = walk(RAW_DIR).filter((p) => {
    const ext = extname(p).toLowerCase();
    if (ext !== ".xls" && ext !== ".xlsx") return false;
    const b = basename(p);
    if (b.startsWith("~$")) return false;
    if (SKIP_FILE_TOKENS.some((t) => b.toLowerCase().includes(t))) return false;
    return true;
  });
}
const isDistrictWide = (p) => {
  const up = basename(p).toUpperCase();
  return DISTRICT_WIDE_TOKENS.some((t) => up.includes(t));
};
files.sort((a, b) => (isDistrictWide(a) ? 1 : 0) - (isDistrictWide(b) ? 1 : 0));

if (!files.length) {
  console.error(`No member files found under ${RAW_DIR}. Run: node extract.mjs first.`);
  process.exit(1);
}

// ------------------------------------------------------------ CSV helpers ----
const esc = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const toCsv = (headers, rows) => [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\r\n") + "\r\n";

// ------------------------------------------------------------ field logic ----
function normAadhaar(v) {
  if (v === null || v === undefined || v === "") return { value: null, issue: null };
  let s = null, issue = null;
  if (typeof v === "number") {
    s = String(Math.round(v));
  } else {
    s = String(v).trim().replace(/[\s.\-]/g, "");
    if (/^\d+(\.0+)?$/.test(s)) s = s.replace(/\.0+$/, "");
    else if (/^\d(\.\d+)?e\+?\d+$/i.test(s)) { s = String(Math.round(Number(s))); issue = "aadhaar-from-scientific-text"; }
  }
  if (!s) return { value: null, issue };
  if (!/^\d{12}$/.test(s)) return { value: null, issue: (issue ? issue + "+" : "") + "aadhaar-invalid(" + s.length + "d)" };
  return { value: s, issue };
}

function normMobile(v) {
  if (v === null || v === undefined || v === "") return { value: null, issue: null };
  let s = typeof v === "number" ? String(Math.round(v)) : String(v).trim().replace(/[\s.\-]/g, "");
  if (/^\d(\.\d+)?e\+?\d+$/i.test(s)) s = String(Math.round(Number(s)));
  s = s.replace(/^0+/, "");
  if (!s) return { value: null, issue: null };
  if (!/^\d{10}$/.test(s)) return { value: null, issue: "mobile-invalid" };
  return { value: s, issue: null };
}

const toAge = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 120 ? n : null;
};

const CAT_MAP = (raw) => {
  const s = String(raw ?? "").trim();
  if (!s) return { value: null, issue: null };
  const u = s.toUpperCase();
  if (u.includes("TRIBE") || u === "ST") return { value: "ST", issue: null };
  if (u.includes("CASTE") || u === "SC") return { value: "SC", issue: null };
  if (u === "OBC") return { value: "OBC", issue: null };
  if (u.includes("GEN")) return { value: "General", issue: null };
  if (u.includes("MINOR")) return { value: "Minority", issue: null };
  if (u.includes("OTHER")) return { value: "Others", issue: null };
  return { value: null, issue: "category-unmapped(" + s + ")" };
};

const GENDER_MAP = (raw) => {
  const u = String(raw ?? "").trim().toUpperCase();
  if (!u) return null;
  if (u.startsWith("M")) return "Male";
  if (u.startsWith("F")) return "Female";
  if (u.startsWith("O") || u.startsWith("T")) return "Other";
  return null;
};

const toPin = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim().replace(/\.0+$/, "");
  return /^\d{6}$/.test(s) ? s : null;
};

function toDateStr(v) {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  if (typeof v === "number" && v > 20000 && v < 60000) {
    // Excel serial date (1900 system)
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s); // 6.2.1983 (D.M.Y)
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return s.length > 40 ? s.slice(0, 40) : s;
}

const clean = (v, max) => {
  if (v === null || v === undefined) return null;
  let s = String(v).trim().replace(/\s+/g, " ");
  if (!s || /^(na|n\/a|none|-|\.)$/i.test(s)) return null;
  if (s.length > 2000) s = s.slice(0, 2000);
  return max && s.length > max ? s.slice(0, max) : s;
};

function cleanAccount(v) {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") return String(Math.round(v));
  let s = String(v).trim();
  if (/^\d(\.\d+)?e\+?\d+$/i.test(s)) return String(Math.round(Number(s)));
  return s.replace(/\s+/g, "");
}

// ------------------------------------------------------- header detection ----
const HEADER_KEYS = {
  refrenceid: "refrenceId", referenceid: "refrenceId",
  nameoftribal: "name", name: "name",
  gender: "gender", dateofbirth: "dob", birthyear: "birthYear", age: "age",
  idtype: "idType", idvalue: "aadhaarRaw",
  mobilenumber: "mobile", address: "address",
  state: "state", district: "district", block: "block",
  grampanchayat: "gramPanchayat", grmapanchayat: "gramPanchayat", village: "village", pincode: "pincode",
  education: "education", occupation: "occupation",
  category: "category", stname: "tribe", shgname: "shgName",
  bankname: "bankName", ifsccode: "ifsc", accountno: "accountNo",
  nameofproposedvdvk: "proposedVdvk", financialyear: "financialYear",
};

function buildCols(headerRow) {
  const cols = {};
  headerRow.forEach((h, i) => {
    const k = norm(h).toLowerCase();
    if (HEADER_KEYS[k] && cols[HEADER_KEYS[k]] === undefined) cols[HEADER_KEYS[k]] = i;
  });
  return cols;
}

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const row = rows[i] || [];
    const ks = row.map((h) => norm(h));
    if (ks.some((k) => k === "NAMEOFTRIBAL" || k === "REFRENCEID" || k === "REFERENCEID")) return i;
  }
  return -1;
}

/** True when row 0 is already data (headerless continuation sheet). */
function looksHeaderless(rows) {
  const r0 = rows[0] || [];
  if (r0.length < 6) return false;
  const isRef = typeof r0[0] === "number" && r0[0] > 1000;
  const isG = typeof r0[2] === "string" && /^(M|F)/i.test(r0[2]);
  const hasName = typeof r0[1] === "string" && r0[1].trim().length > 2;
  return isRef && isG && hasName;
}

/** Real data extent of a sheet (ignores style-only cells) for sheet_to_json. */
function realExtent(ws) {
  let maxRow = 0, maxCol = 0;
  for (const k in ws) {
    if (k.charCodeAt(0) === 33) continue; // "!"
    const cell = ws[k];
    if (!cell || cell.v === undefined || cell.v === null || cell.v === "") continue;
    let r = 0, i = k.length;
    while (i > 0) {
      const c = k.charCodeAt(i - 1);
      if (c < 48 || c > 57) break;
      r = r * 10 + (c - 48);
      i--;
    }
    if (r > maxRow) maxRow = r;
    let col = 0;
    for (let j = 0; j < i; j++) {
      const c = k.charCodeAt(j);
      if (c < 65 || c > 90) { col = -1; break; }
      col = col * 26 + (c - 64);
    }
    if (col > maxCol) maxCol = col;
  }
  if (!maxRow || !maxCol) return undefined;
  return { s: { r: 0, c: 0 }, e: { r: maxRow - 1, c: maxCol - 1 } };
}

// ==================================================================== main ===
mkdirSync(OUT_DIR, { recursive: true });

const stats = {
  filesRead: 0, sheetsProcessed: 0, sheetsSkipped: 0, sheetsTemplateHeader: 0,
  rowsRead: 0, rowsBlank: 0,
  dupAadhaar: 0, dupComposite: 0, dupUnmatched: 0, superseded: 0, upgraded: 0,
  matched: 0, unmatched: 0,
  missing: { aadhaar: 0, mobile: 0, village: 0, age: 0, name: 0, pincode: 0, noAadhaarCompositeWeak: 0 },
  issues: {}, categoryDist: {}, genderDist: {},
  vdvkFrom: { proposed: 0, sheet: 0, file: 0, scoped: 0 },
  mandalMismatch: 0, ctxMismatch: 0,
};
const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };

const idIndex = new Map(); // identity key -> entry[] (list: same name + different Aadhaar)
function registerId(keys, entry) {
  for (const k of keys) {
    if (!k) continue;
    let l = idIndex.get(k);
    if (!l) { l = []; idIndex.set(k, l); }
    if (!l.includes(entry)) l.push(entry);
  }
}
function findId(aadKey, pKey, gKey) {
  if (aadKey) {
    const l = idIndex.get(aadKey);
    if (l && l.length) return l[0]; // Aadhaar is authoritative
  }
  if (pKey) {
    const l = idIndex.get(pKey) || [];
    for (const e of l) {
      if (aadKey && e.aadKey && e.aadKey !== aadKey) continue; // distinct people sharing a name
      return e;
    }
  }
  // supersede path: an earlier QUARANTINED occurrence of this name (any
  // context) is replaced as soon as the same person resolves to a VDVK
  if (gKey) {
    const l = idIndex.get(gKey) || [];
    const e = l.find((x) => x.unmatched);
    if (e) return e;
  }
  return null;
}
const matched = [];
const unmatched = [];
const recon = new Map(); // normProposed -> recon row
const perVdvk = new Map();
let baseline = [];

function contextFor(filePath, sheetName, block) {
  return mandalFrom(sheetName) ||
    mandalFrom(relative(RAW_DIR, filePath).split(/[\\/]/).slice(0, -1).join(" ")) ||
    mandalFrom(block) || null;
}

function reconStatusFromError(err) {
  if (!err) return "UNMATCHED";
  if (err.reason && err.reason.startsWith("ambiguous")) return "AMBIGUOUS";
  return "UNMATCHED";
}

function reconEntry(rawValue, ctx, vdvk, vdvkError) {
  const key = norm(rawValue || "(blank)") || "(blank)";
  let rc = recon.get(key);
  if (!rc) {
    rc = {
      proposedValue: (rawValue || "(blank)").trim(), count: 0,
      status: vdvk ? "MATCHED" : reconStatusFromError(vdvkError),
      matchedCode: vdvk?.code || "", matchedName: vdvk?.name || "",
      method: vdvk ? "" : "", reason: vdvkError?.reason || "",
      newName: vdvkError?.newName || "",
      candidates: (vdvkError?.candidates || []).map((v) => v.code + " " + v.name).join(" | "),
      exampleContext: ctx, key,
    };
    recon.set(key, rc);
  }
  return rc;
}

for (const file of files) {
  let wb;
  try {
    // sheetRows caps parsing: no legitimate member sheet exceeds ~5k rows, but
    // several workbooks carry style records down to Excel's 1,048,576th row
    wb = XLSX.readFile(file, { cellDates: true, sheetRows: 20000 });
  } catch (e) {
    console.error(`ERR read ${basename(file)}: ${e.message}`);
    continue;
  }
  stats.filesRead++;
  const folder = relative(RAW_DIR, dirname(file));
  const fileBase = basename(file, extname(file));

  // VDVK-specific sheets first, then mandal-wide sheets
  const sheetNames = wb.SheetNames.slice().sort((a, b) => (mandalFrom(a) ? 1 : 0) - (mandalFrom(b) ? 1 : 0));

  for (const sname of sheetNames) {
    if (/shg\s*gatherer/i.test(sname)) { stats.sheetsSkipped++; continue; }
    const ws = wb.Sheets[sname];
    if (!ws) continue;
    let rows;
    try {
      rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, range: realExtent(ws) });
    } catch (e) { continue; }
    if (!rows || rows.length < 2) { stats.sheetsSkipped++; continue; }

    let hIdx = findHeaderRow(rows);
    let templateHeader = false;
    if (hIdx < 0 && looksHeaderless(rows)) {
      hIdx = -1; // data starts at row 0 with canonical template columns
      templateHeader = true;
      stats.sheetsTemplateHeader++;
    }
    if (hIdx < 0 && !templateHeader) { stats.sheetsSkipped++; continue; }

    const headerRow = templateHeader ? TEMPLATE_HEADERS : rows[hIdx];
    const cols = buildCols(headerRow);
    if (!("name" in cols)) { stats.sheetsSkipped++; continue; }
    stats.sheetsProcessed++;

    const sheetMandal = mandalFrom(sname);
    const folderMandal = mandalFrom(folder);
    const GENERIC_SHEET = /^(SHEET|TAB|DATA)[\s\d]*$/i;
    const sheetVdvkFallback = (() => {
      if (sheetMandal || GENERIC_SHEET.test(sname.trim())) return null;
      const r = matchVdvk(sname, folderMandal);
      return r.vdvk ? r : null;
    })();
    const fileVdvkFallback = (() => {
      if (isDistrictWide(file)) return null;
      const cleaned = fileBase.replace(/(VDVK|VDVDK|MEMBERS?|DATA|FINAL|DETA|WISE|BASE|MANDAL)/gi, " ");
      const r = matchVdvk(cleaned, folderMandal);
      return r.vdvk ? r : null;
    })();

    const firstDataRow = templateHeader ? 0 : hIdx + 1;
    for (let r = firstDataRow; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const get = (f) => (cols[f] !== undefined ? row[cols[f]] : null);
      const name = clean(get("name"), 191);
      if (!name) { stats.rowsBlank++; continue; }
      stats.rowsRead++;

      const issues = [];
      const aad = normAadhaar(get("aadhaarRaw"));
      if (aad.issue) issues.push(aad.issue);
      const mob = normMobile(get("mobile"));
      if (mob.issue) issues.push(mob.issue);
      const cat = CAT_MAP(get("category"));
      if (cat.issue) issues.push(cat.issue);
      const gender = GENDER_MAP(get("gender"));
      const dob = toDateStr(get("dob"));
      let age = toAge(get("age"));
      if (age === null && get("birthYear")) {
        const by = Math.round(Number(get("birthYear")));
        if (Number.isFinite(by) && by > 1900 && by < CURRENT_YEAR + 1) age = CURRENT_YEAR - by;
      }
      const block = clean(get("block"), 64);
      const village = clean(get("village"), 191);
      const pincode = toPin(get("pincode"));
      const ctxMandal = contextFor(file, sname, block);
      const scope = { fileBase, sheetName: sname, village: village || "" };

      // ---- VDVK resolution
      let vdvk = null, vdvkSource = null, vdvkError = null, ctxMismatch = false;
      const proposed = clean(get("proposedVdvk"), 191);
      const scoped = scopedResolve(proposed, scope);
      if (scoped) {
        if (typeof scoped === "string" && scoped.startsWith("NEW:")) {
          vdvkError = { value: proposed || "", reason: "missing-vdvk", newName: scoped.slice(4) };
        } else {
          const v = vdvkByCode[scoped];
          if (v) { vdvk = v; vdvkSource = "scoped"; stats.vdvkFrom.scoped++; }
          else vdvkError = { reason: `scoped-alias-unknown-code(${scoped})` };
        }
      }
      if (!vdvk && !scoped) {
        if (proposed) {
          const r = matchVdvk(proposed, ctxMandal);
          if (r.vdvk) {
            vdvk = r.vdvk; vdvkSource = "proposed"; ctxMismatch = !!r.ctxMismatch;
            if (r.method === "alias") vdvkSource = "alias";
          } else {
            vdvkError = { value: proposed, reason: r.error || "unmatched", newName: r.newName, candidates: r.candidates || [] };
          }
        } else {
          if (sheetVdvkFallback) { vdvk = sheetVdvkFallback.vdvk; vdvkSource = "sheet"; }
          else if (fileVdvkFallback) { vdvk = fileVdvkFallback.vdvk; vdvkSource = "file"; }
          else vdvkError = { value: "", reason: "blank-proposed-no-fallback" };
        }
      }
      if (vdvk && vdvkSource !== "scoped") {
        if (vdvkSource === "sheet") stats.vdvkFrom.sheet++;
        else if (vdvkSource === "file") stats.vdvkFrom.file++;
        else if (vdvkSource === "alias") stats.vdvkFrom.alias = (stats.vdvkFrom.alias || 0) + 1;
        else stats.vdvkFrom.proposed++;
      }

      // ---- identity keys (dedupe)
      // Aadhaar is authoritative. Without one, collapse by name+gender within
      // the same VDVK: the same person is re-listed across district copies with
      // conflicting dob/village/mobile, so composite keys leaked duplicates
      // (DEVAPURAM 612, BADIMELA 507, ...). Same name + different Aadhaar in
      // the same VDVK stays as two separate entries.
      const aadKey = aad.value ? "A:" + aad.value : null;
      const parts = [dob, village, mob.value].filter(Boolean).length;
      if (!aadKey && parts < 2) stats.missing.noAadhaarCompositeWeak++;
      const pScope = vdvk ? vdvk.code : "U:" + (ctxMandal || "") + ":" + (norm(proposed) || "BLANK");
      const pKey = "P:" + pScope + "|" + norm(name) + "|" + (gender || "");
      const gKey = "G:" + norm(name) + "|" + (gender || "");
      const existing = findId(aadKey, pKey, gKey);

      // ---- dedupe / supersede
      if (existing) {
        if (existing.unmatched && vdvk) {
          // better resolution found later — replace the quarantined entry
          if (existing.idx !== null && unmatched[existing.idx]) {
            unmatched[existing.idx] = null;
            const g = recon.get(existing.reconKey);
            if (g) { g.count = Math.max(0, g.count - 1); }
          }
          stats.superseded++;
          existing.unmatched = false;
          existing.idx = null;
        } else {
          if (vdvk && aadKey && !existing.aadKey) {
            existing.aadKey = aadKey;
            registerId([aadKey], existing);
            stats.upgraded++;
          }
          if (existing.unmatched) stats.dupUnmatched++;
          else if (aadKey && existing.aadKey === aadKey) stats.dupAadhaar++;
          else stats.dupComposite++;
          continue;
        }
      }

      // ---- recon bookkeeping (post-dedupe counts)
      const rc = reconEntry(proposed || "", `${folder} / ${sname}`, vdvk, vdvkError);
      if (vdvk && rc.status !== "MATCHED") { rc.status = "MATCHED"; rc.matchedCode = ""; }
      if (vdvk) { rc.matchedCode = vdvk.code; rc.matchedName = vdvk.name; rc.method = vdvkSource; }
      rc.count++;

      // ---- unmatched -> quarantine
      if (!vdvk) {
        stats.unmatched++;
        const idx = unmatched.length;
        unmatched.push({
          reason: vdvkError?.reason || "unknown", proposedValue: proposed || "",
          name, gender: gender || "", age: age ?? "", aadhaar: aad.value || "",
          mobile: mob.value || "", village: village || "", block: block || "",
          pincode: pincode || "", category: cat.value || "",
          mandalContext: ctxMandal || "", sheet: sname, file: folder + "/" + basename(file),
        });
        const entry = { unmatched: true, idx, aadKey, reconKey: rc.key };
        registerId([aadKey, pKey, gKey], entry);
        continue;
      }

      if (ctxMismatch) stats.ctxMismatch++;

      // ---- flags & quality stats
      const mandalCode = vdvk.mandalCode;
      const flags = [];
      if (templateHeader) flags.push("header-template");
      if (block && mandalFrom(block) && mandalFrom(block) !== mandalCode) {
        flags.push("block-mandal-mismatch:" + mandalFrom(block));
        stats.mandalMismatch++;
      }
      if (sheetMandal && sheetMandal !== mandalCode) { flags.push("sheet-mandal-mismatch:" + sheetMandal); stats.mandalMismatch++; }
      if (folderMandal && folderMandal !== mandalCode) { flags.push("folder-mandal-mismatch:" + folderMandal); stats.mandalMismatch++; }
      if (ctxMismatch) flags.push("vdvk-ctx-mismatch");
      if (vdvkSource !== "proposed" && vdvkSource !== "scoped") flags.push("vdvk-from-" + vdvkSource);
      if (vdvkSource === "scoped") flags.push("vdvk-from-alias");
      if (!aad.value) flags.push("no-aadhaar");
      if (!mob.value) flags.push("no-mobile");
      if (!village) flags.push("no-village");
      if (age === null) flags.push("no-age");
      if (aad.issue) flags.push(aad.issue);
      if (mob.issue) flags.push(mob.issue);

      if (!aad.value) stats.missing.aadhaar++;
      if (!mob.value) stats.missing.mobile++;
      if (!village) stats.missing.village++;
      if (age === null) stats.missing.age++;
      if (pincode === null) stats.missing.pincode++;
      bump(stats.categoryDist, cat.value || "(blank)");
      bump(stats.genderDist, gender || "(blank)");
      for (const i of issues) bump(stats.issues, i);

      stats.matched++;
      if (existing) {
        // reused a superseded quarantine entry — re-index it under the resolved VDVK
        if (!existing.aadKey && aadKey) { existing.aadKey = aadKey; registerId([aadKey], existing); stats.upgraded++; }
        existing.reconKey = rc.key;
        registerId([pKey, gKey], existing);
      } else {
        const entry = { unmatched: false, idx: null, aadKey, reconKey: rc.key };
        registerId([aadKey, pKey, gKey], entry);
      }

      const hasIncomplete = !aad.value || !mob.value || !village || age === null;
      matched.push({
        vdvkcode: vdvk.code,
        name,
        age: age ?? "",
        gender: gender || "",
        mobile: mob.value || "",
        aadhaar: aad.value || "",
        address: clean(get("address"), 500) || "",
        state: STATE,
        district: DISTRICT,
        mandal: mandalCode,
        village: village || "",
        pincode: pincode || "",
        category: cat.value || "",
        // extended (members-full.csv only)
        refrenceid: clean(get("refrenceId"), 64) || "",
        dob: dob || "",
        shgname: clean(get("shgName"), 191) || "",
        tribe: clean(get("tribe"), 191) || "",
        education: clean(get("education"), 64) || "",
        occupation: clean(get("occupation"), 120) || "",
        bankname: clean(get("bankName"), 191) || "",
        ifsc: clean(get("ifsc"), 32) || "",
        accountno: cleanAccount(get("accountNo")),
        financialyear: clean(get("financialYear"), 32) || "",
        grampanchayat: clean(get("gramPanchayat"), 191) || "",
        flags: flags.join(";"),
        hasincomplete: hasIncomplete ? "true" : "false",
        proposedvdvkraw: proposed || "",
        sourcefile: folder.replace(/\\/g, "/") + "/" + basename(file),
        sourcesheet: sname,
      });
      perVdvk.set(vdvk.code, (perVdvk.get(vdvk.code) || 0) + 1);
    }
  }
}

// ------------------------------------------------------------- baseline ------
const reportPath = walk(RAW_DIR).find((p) => basename(p).toLowerCase() === REPORT_XLSX.toLowerCase());
if (reportPath) {
  try {
    const wb = XLSX.readFile(reportPath, { cellDates: true });
    const ws = wb.Sheets["Mandal Wise "] || wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    for (let i = 2; i < rows.length; i++) {
      const r = rows[i];
      if (!r || !r[3]) continue;
      const vName = clean(r[3], 191);
      const cnt = Math.round(Number(r[5]));
      if (!vName || !Number.isFinite(cnt)) continue;
      const m = matchVdvk(vName, mandalFrom(r[1]));
      baseline.push({ reportVdvkName: vName, reportMandal: r[1] || "", reportCount: cnt, matchedCode: m.vdvk?.code || "", matchedName: m.vdvk?.name || "" });
    }
  } catch (e) {
    console.error("WARN: baseline report read failed: " + e.message);
  }
}

// ------------------------------------------------------------- outputs -------
const IMPORT_HEADERS = ["vdvkcode", "name", "age", "gender", "mobile", "aadhaar", "address", "state", "district", "mandal", "village", "pincode", "category"];
const FULL_HEADERS = [...IMPORT_HEADERS, "refrenceid", "dob", "shgname", "tribe", "education", "occupation", "bankname", "ifsc", "accountno", "financialyear", "grampanchayat", "flags", "hasincomplete", "proposedvdvkraw", "sourcefile", "sourcesheet"];

writeFileSync(join(OUT_DIR, "members-import.csv"), toCsv(IMPORT_HEADERS, matched), "utf8");
writeFileSync(join(OUT_DIR, "members-full.csv"), toCsv(FULL_HEADERS, matched), "utf8");

const cleanUnmatched = unmatched.filter(Boolean);
const UNMATCHED_HEADERS = ["reason", "proposedValue", "name", "gender", "age", "aadhaar", "mobile", "village", "block", "pincode", "category", "mandalContext", "sheet", "file"];
writeFileSync(join(OUT_DIR, "members-unmatched.csv"), toCsv(UNMATCHED_HEADERS, cleanUnmatched), "utf8");

const reconRows = [...recon.values()].filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
writeFileSync(
  join(OUT_DIR, "vdvk-reconciliation.csv"),
  toCsv(["proposedValue", "count", "status", "matchedCode", "matchedName", "method", "reason", "candidates", "exampleContext"], reconRows),
  "utf8"
);

writeFileSync(
  join(OUT_DIR, "vdvk-master-list.csv"),
  toCsv(["code", "name", "mandal", "seedBeneficiaryCount", "loadedCount"],
    vdvks.map((v) => ({ code: v.code, name: v.name, mandal: v.mandalCode, seedBeneficiaryCount: v.beneficiaryCount, loadedCount: perVdvk.get(v.code) || 0 }))),
  "utf8"
);

// coverage vs report
const covRows = [];
const baseByCode = new Map();
for (const b of baseline) if (b.matchedCode && !baseByCode.has(b.matchedCode)) baseByCode.set(b.matchedCode, b);
for (const v of vdvks) {
  const loaded = perVdvk.get(v.code) || 0;
  const base = baseByCode.get(v.code);
  covRows.push({
    code: v.code, name: v.name, mandal: v.mandalCode,
    loadedCount: loaded, seedBeneficiaryCount: v.beneficiaryCount,
    reportCount: base?.reportCount ?? "", reportName: base?.reportVdvkName ?? "",
    delta: base ? loaded - base.reportCount : "",
  });
}
const unmatchedReportNames = [];
for (const b of baseline) {
  if (!b.matchedCode) {
    unmatchedReportNames.push(b);
    covRows.push({ code: "", name: b.reportVdvkName, mandal: "", loadedCount: "", seedBeneficiaryCount: "", reportCount: b.reportCount, reportName: b.reportVdvkName, delta: "" });
  }
}
writeFileSync(join(OUT_DIR, "coverage-vs-report.csv"), toCsv(["code", "name", "mandal", "loadedCount", "seedBeneficiaryCount", "reportCount", "reportName", "delta"], covRows), "utf8");

// new-VDVK proposals: unmatched groups >= 20 people (post-dedupe)
const propRows = [];
const stripFx = (s) => norm(s).replace(/VDVK|VDVDK|FPO/g, "");
for (const r of reconRows) {
  if (r.status === "MATCHED" || r.count < 20) continue;
  if (["(blank)", "VDVK", "YES"].includes(r.proposedValue.toUpperCase())) continue;
  const inReport = unmatchedReportNames.some((b) =>
    norm(b.reportVdvkName).includes(norm(r.proposedValue)) ||
    norm(r.proposedValue).includes(norm(b.reportVdvkName)) ||
    (stripFx(r.proposedValue).length >= 5 && stripFx(b.reportVdvkName).includes(stripFx(r.proposedValue)))
  );
  // mandal: from the first quarantined row with this value
  const mand = cleanUnmatched.find((u) => norm(u.proposedValue || "(blank)") === r.key)?.mandalContext || "";
  propRows.push({
    proposedValue: r.proposedValue,
    suggestedName: r.newName || "",
    mandal: mand, people: r.count, status: r.status,
    inReport: inReport ? "yes" : "no", exampleContext: r.exampleContext,
  });
}
writeFileSync(join(OUT_DIR, "new-vdvk-proposals.csv"), toCsv(["proposedValue", "suggestedName", "mandal", "people", "status", "inReport", "exampleContext"], propRows), "utf8");

// ---------------------------------------------------------------- report -----
const matchedVdvks = new Set(matched.map((m) => m.vdvkcode));
const notLoaded = vdvks.filter((v) => !matchedVdvks.has(v.code));
const reportGap = vdvks.filter((v) => {
  const b = baseByCode.get(v.code);
  return b && b.reportCount > 0 && (perVdvk.get(v.code) || 0) < b.reportCount / 2;
});
const masterOnly = notLoaded.filter((v) => !baseByCode.has(v.code));
const ambiguousRecon = reconRows.filter((r) => r.status === "AMBIGUOUS");
const unmatchedRecon = reconRows.filter((r) => r.status === "UNMATCHED");

const md = `# VDVK member import — conversion report
Generated: ${new Date().toISOString()}

## Source
- Files read: **${stats.filesRead}** (sheets processed: ${stats.sheetsProcessed}, skipped: ${stats.sheetsSkipped}, parsed via template header: ${stats.sheetsTemplateHeader})
- Raw rows with a name: **${stats.rowsRead}**

## Dedupe
| Counter | Rows |
|---|---|
| Duplicate Aadhaar removed | ${stats.dupAadhaar} |
| Duplicate composite-key removed | ${stats.dupComposite} |
| Duplicate quarantined rows removed | ${stats.dupUnmatched} |
| Superseded (unmatched -> matched later) | ${stats.superseded} |
| Aadhaar upgraded onto composite match | ${stats.upgraded} |
| Blank-name rows skipped | ${stats.rowsBlank} |

## Result
- **${matched.length} unique members** ready to import (matched to a seeded VDVK)
- **${cleanUnmatched.length} rows quarantined** in \`members-unmatched.csv\`
- VDVKs receiving data: ${matchedVdvks.size} / ${vdvks.length} seeded
- VDVK resolved from: proposed column ${stats.vdvkFrom.proposed}, alias ${stats.vdvkFrom.alias ?? 0}+scoped ${stats.vdvkFrom.scoped}, sheet-name fallback ${stats.vdvkFrom.sheet}, file-name fallback ${stats.vdvkFrom.file}
- Flags: ${stats.mandalMismatch} mandal-context mismatches, ${stats.ctxMismatch} VDVK mandal-context mismatches

## Seeded VDVKs with NO data loaded (${notLoaded.length})
${reportGap.length ? `### ⚠ In the Member Wise report but <50% loaded — investigate\n${reportGap.map((v) => `- ${v.code} ${v.name} (report: ${baseByCode.get(v.code).reportVdvkName}, ${baseByCode.get(v.code).reportCount}, loaded: ${perVdvk.get(v.code) || 0})`).join("\n")}\n` : ""}
${masterOnly.length ? `### Only in VDVK Master, absent from report AND source (expected 0)\n${masterOnly.map((v) => `- ${v.code} ${v.name}`).join("\n")}\n` : ""}

## Data quality (loaded rows)
| Metric | Count |
|---|---|
| Missing Aadhaar | ${stats.missing.aadhaar} |
| Missing mobile | ${stats.missing.mobile} |
| Missing village | ${stats.missing.village} |
| Missing age | ${stats.missing.age} |
| Missing/invalid pincode | ${stats.missing.pincode} |
| Weak identity (no aadhaar, <2 of dob/village/mobile) | ${stats.missing.noAadhaarCompositeWeak} |

- Gender: ${Object.entries(stats.genderDist).map(([k, v]) => `${k}=${v}`).join(", ")}
- Category: ${Object.entries(stats.categoryDist).map(([k, v]) => `${k}=${v}`).join(", ")}
- Field issues: ${Object.entries(stats.issues).map(([k, v]) => `${k}=${v}`).join(", ") || "none"}

## VDVK name reconciliation (\`vdvk-reconciliation.csv\`)
- Distinct source VDVK values: ${reconRows.length} — MATCHED: ${reconRows.filter((r) => r.status === "MATCHED").length}, AMBIGUOUS: ${ambiguousRecon.length}, UNMATCHED: ${unmatchedRecon.length}
${ambiguousRecon.length ? "\n### Ambiguous (needs alias)\n" + ambiguousRecon.map((r) => `- \`${r.proposedValue}\` (${r.count} rows) → candidates: ${r.candidates}`).join("\n") : ""}
${unmatchedRecon.length ? "\n### Unmatched source values (quarantined)\n" + unmatchedRecon.slice(0, 50).map((r) => `- \`${r.proposedValue}\` (${r.count} rows) — e.g. ${r.exampleContext}`).join("\n") + (unmatchedRecon.length > 50 ? `\n- … and ${unmatchedRecon.length - 50} more (see CSV)` : "") : ""}

## Missing VDVKs (\`new-vdvk-proposals.csv\`)
${propRows.length ? propRows.map((p) => `- **${p.proposedValue}** (${p.mandal || "?"}, ${p.people} people, in report: ${p.inReport})`).join("\n") : "- none"}

## How to fix remaining names / load
1. Edit \`vdvk-aliases.json\` (keys = source spelling, value = code from \`vdvk-master-list.csv\`), re-run \`npm run convert\`.
2. Decide on \`new-vdvk-proposals.csv\` (create the VDVKs via loader flag \`--create-missing-vdvk\` or leave quarantined).
3. Load: \`node ../backend/import-members.cjs --dry-run\` first, then without the flag.
`;

writeFileSync(join(OUT_DIR, "import-report.md"), md, "utf8");

console.log(`
=== convert-members summary ===
files read             : ${stats.filesRead}
raw rows               : ${stats.rowsRead}
template-header sheets : ${stats.sheetsTemplateHeader}
MATCHED  -> import     : ${matched.length}
UNMATCHED -> quarantined: ${cleanUnmatched.length}
  (dedupe: ${stats.dupAadhaar} aadhaar + ${stats.dupComposite} composite + ${stats.dupUnmatched} unmatched dups, ${stats.superseded} superseded)
VDVKs loaded           : ${matchedVdvks.size}/${vdvks.length}
recon: ${reconRows.filter((r) => r.status === "MATCHED").length} matched, ${ambiguousRecon.length} ambiguous, ${unmatchedRecon.length} unmatched source names
report-gap VDVKs (report>0, <50% loaded): ${reportGap.map((v) => v.code).join(", ") || "none"}
new-vdvk proposals     : ${propRows.length}
outputs -> ${OUT_DIR}
`);
