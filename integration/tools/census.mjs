// census.mjs — distinct (mandalContext, proposed VDVK) pairs with unique-person
// counts across all raw member files. Output: ../data/proposed-census.csv
// Used to design the definitive alias/mapping table.
import { createRequire } from "node:module";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, basename, extname, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const HERE = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = join(HERE, "..", "data", "raw");
const OUT = join(HERE, "..", "data", "proposed-census.csv");

const norm = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const stripVdvk = (n) => n.replace(/(VDVDK|VDVKM?S?)$/, "");
const seed = require(join(HERE, "..", "..", "vdvk-backend", "src", "db", "seed", "data", "real-data.cjs"));
const mandals = seed.mandals.map(([code, name]) => ({ code, n: norm(name) }));

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function mandalFrom(str) {
  const n = norm(str);
  if (!n || n.length < 4) return null;
  let best = null;
  for (const m of mandals) {
    let hit = m.n === n || (n.length >= 5 && (m.n.includes(n) || (n.includes(m.n) && m.n.length >= 5))) || (n.length >= 6 && lev(n, m.n) <= 1);
    if (hit && (!best || m.n.length > best.n.length)) best = m;
  }
  return best ? best.code : null;
}
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
function realExtent(ws) {
  let maxRow = 0, maxCol = 0;
  for (const k in ws) {
    if (k.charCodeAt(0) === 33) continue;
    const c = ws[k];
    if (!c || c.v === undefined || c.v === null || c.v === "") continue;
    let r = 0, i = k.length;
    while (i > 0) { const d = k.charCodeAt(i - 1); if (d < 48 || d > 57) break; r = r * 10 + (d - 48); i--; }
    if (r > maxRow) maxRow = r;
    let col = 0;
    for (let j = 0; j < i; j++) { const d = k.charCodeAt(j); if (d < 65 || d > 90) { col = -1; break; } col = col * 26 + (d - 64); }
    if (col > maxCol) maxCol = col;
  }
  if (!maxRow || !maxCol) return undefined;
  return { s: { r: 0, c: 0 }, e: { r: maxRow - 1, c: maxCol - 1 } };
}

const HEADER_KEYS = { nameoftribal: "name", nameofproposedvdvk: "proposed", block: "block", idvalue: "aadhaar", refrenceid: "ref" };

let files = existsSync(RAW_DIR) ? walk(RAW_DIR).filter((p) => {
  const ext = extname(p).toLowerCase();
  const b = basename(p);
  return (ext === ".xls" || ext === ".xlsx") && !b.startsWith("~$") && !b.toLowerCase().includes("member wise data report");
}) : [];
if (!files.length) { console.error("no raw files — run extract.mjs first"); process.exit(1); }

const seenAadhaar = new Set();
const groups = new Map(); // key -> {ctx, proposed, people, sheets:Set, files:Set}

for (const file of files) {
  let wb;
  try { wb = XLSX.readFile(file, { cellDates: true, sheetRows: 20000 }); } catch (e) { continue; }
  const folder = relative(RAW_DIR, dirname(file));
  for (const sname of wb.SheetNames) {
    if (/shg\s*gatherer/i.test(sname)) continue;
    const ws = wb.Sheets[sname];
    if (!ws) continue;
    let rows;
    try { rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, range: realExtent(ws) }); } catch (e) { continue; }
    if (!rows || rows.length < 2) continue;
    let hIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 8); i++) {
      const ks = (rows[i] || []).map((h) => norm(h).toLowerCase());
      if (ks.includes("nameoftribal") || ks.includes("refrenceid")) { hIdx = i; break; }
    }
    if (hIdx < 0) continue;
    const cols = {};
    rows[hIdx].forEach((h, i) => { const k = norm(h).toLowerCase(); if (HEADER_KEYS[k]) cols[HEADER_KEYS[k]] = i; });
    if (!("name" in cols)) continue;
    const sheetCtx = mandalFrom(sname) || mandalFrom(folder);

    for (let r = hIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const name = row[cols.name];
      if (!name || !String(name).trim()) continue;
      const aad = cols.aadhaar !== undefined ? row[cols.aadhaar] : null;
      const aadKey = aad !== null && aad !== undefined && String(aad).trim() !== "" ? "A:" + norm(aad) : null;
      if (aadKey) { if (seenAadhaar.has(aadKey)) continue; seenAadhaar.add(aadKey); }
      const propRaw = cols.proposed !== undefined && row[cols.proposed] !== null && row[cols.proposed] !== undefined ? String(row[cols.proposed]).trim() : "";
      const block = cols.block !== undefined && row[cols.block] ? String(row[cols.block]).trim() : "";
      const ctx2 = sheetCtx || mandalFrom(block) || "(none)";
      const propKey = propRaw || "(blank)";
      const key = ctx2 + "||" + norm(propKey);
      if (!groups.has(key)) groups.set(key, { ctx: ctx2, proposed: propKey, people: 0, sheets: new Set(), files: new Set() });
      const g = groups.get(key);
      g.people++;
      if (g.sheets.size < 3) g.sheets.add(sname);
      if (g.files.size < 3) g.files.add(basename(file));
    }
  }
}

const esc = (v) => { const s = String(v ?? ""); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const out = [...groups.values()].sort((a, b) => a.ctx.localeCompare(b.ctx) || b.people - a.people);
const lines = ["ctx,proposed,people,exampleSheets,exampleFiles"];
for (const g of out) lines.push([g.ctx, g.proposed, g.people, [...g.sheets].join(" ; "), [...g.files].join(" ; ")].map(esc).join(","));
require("node:fs").writeFileSync(OUT, lines.join("\r\n") + "\r\n", "utf8");
console.log(`groups=${out.length} -> ${OUT}`);
