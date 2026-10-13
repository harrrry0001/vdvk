// evidence.mjs — gather the facts needed to finalise VDVK mapping decisions
import { createRequire } from "node:module";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, basename, extname, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const HERE = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = join(HERE, "..", "data", "raw");
const seed = require(join(HERE, "..", "..", "vdvk-backend", "src", "db", "seed", "data", "real-data.cjs"));
const norm = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// ---- 1. seed beneficiary villages for key VDVKs
const KEY_VDK = ["VDK-004","VDK-014","VDK-020","VDK-033","VDK-039","VDK-042","VDK-052","VDK-062","VDK-076","VDK-092","VDK-094","VDK-101","VDK-103","VDK-104"];
console.log("=== seed beneficiary villages for key VDVKs ===");
const byV = {};
for (const b of seed.beneficiaries) { (byV[b[1]] ||= []).push(b); }
for (const v of KEY_VDK) {
  const rows = byV[v] || [];
  const vdc = seed.vdvks.find((x) => x[0] === v);
  console.log(`${v} ${vdc ? vdc[2] : "?"} (${rows.length} seed ben): ${rows.map((r) => r[9]).join(", ") || "-"}`);
}

// ---- 2. targeted row scan of raw files
const TARGETS = new Set(["FPO VDVK SUKURU","Gudemkothaveedhi","FPO GK VEEDHI","fpogkveedhi","kothapalem","KOTTAPALEM","Pedakodapalli","pedakodapalli","vantlamamidi","Kumbidisingi","FPO DUMBRIGUDA","Lyganda","SADA","FPO Aaraku Valley","pedakantavaram VDVK","PedakantavaramVDVK","pedabayalu FPO","fpo hukumpeta","FPOKOYYURU","Kanthalangi"]);
const hits = new Map(); // target -> {people, villages:Map, places:[file|sheet], aadhaar:Set}
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
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
const FILES = existsSync(RAW_DIR) ? walk(RAW_DIR).filter((p) => {
  const ext = extname(p).toLowerCase(), b = basename(p);
  return (ext === ".xls" || ext === ".xlsx") && !b.startsWith("~$") && !b.toLowerCase().includes("member wise data report");
}) : [];
if (!FILES.length) { console.error("no raw files"); process.exit(1); }

for (const file of FILES) {
  let wb;
  try { wb = XLSX.readFile(file, { cellDates: true, sheetRows: 20000 }); } catch (e) { continue; }
  for (const sname of wb.SheetNames) {
    if (/shg\s*gatherer/i.test(sname)) continue;
    const ws = wb.Sheets[sname];
    if (!ws) continue;
    let rows;
    try { rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, range: realExtent(ws) }); } catch (e) { continue; }
    if (!rows || rows.length < 2) continue;
    let hIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const ks = (rows[i] || []).map((h) => norm(h).toLowerCase());
      if (ks.includes("nameoftribal") || ks.includes("refrenceid")) { hIdx = i; break; }
    }
    if (hIdx < 0) continue;
    const cols = {};
    rows[hIdx].forEach((h, i) => { const k = norm(h).toLowerCase(); if (["nameoftribal","nameofproposedvdvk","village","idvalue"].includes(k)) cols[k] = i; });
    if (!("nameoftribal" in cols)) continue;
    const rel = relative(RAW_DIR, file).replace(/\\/g, "/");
    const isNgo = /NGO/i.test(basename(file)), isVelugu = /VELUGU/i.test(basename(file));
    for (let r = hIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const nm = row[cols.nameoftribal];
      if (!nm || !String(nm).trim()) continue;
      let prop = cols.nameofproposedvdvk !== undefined && row[cols.nameofproposedvdvk] != null ? String(row[cols.nameofproposedvdvk]).trim() : "";
      if (isNgo) prop = "[NGO-file] " + prop;
      if (isVelugu) prop = "[VELUGU-file] " + prop;
      if (!TARGETS.has(prop) && !/^\[(NGO|VELUGU)-file\]/.test(prop)) continue;
      const key = prop;
      if (!hits.has(key)) hits.set(key, { people: 0, villages: new Map(), places: new Set(), aadhaar: new Set() });
      const g = hits.get(key);
      const aad = cols.idvalue !== undefined && row[cols.idvalue] != null ? norm(row[cols.idvalue]) : "";
      if (aad && g.aadhaar.has(aad)) continue;
      if (aad) g.aadhaar.add(aad);
      g.people++;
      const vil = cols.village !== undefined && row[cols.village] != null ? String(row[cols.village]).trim() : "";
      if (vil) g.villages.set(vil, (g.villages.get(vil) || 0) + 1);
      if (g.places.size < 4) g.places.add(`${basename(file)} | ${sname}`);
    }
  }
}

console.log("\n=== target proposed values: people / top villages / places ===");
for (const [k, g] of [...hits.entries()].sort()) {
  const topV = [...g.villages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([v, c]) => `${v}(${c})`).join(", ");
  console.log(`\n${k}: people=${g.people}`);
  console.log(`  villages: ${topV}`);
  console.log(`  places: ${[...g.places].join(" || ")}`);
}

// ---- 3. overlap check Gudemkothaveedhi vs FPO GK VEEDHI
const a = hits.get("Gudemkothaveedhi")?.aadhaar, b = hits.get("FPO GK VEEDHI")?.aadhaar;
if (a && b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  console.log(`\noverlap Gudemkothaveedhi(${a.size}) vs FPO GK VEEDHI(${b.size}): ${inter}`);
}

// ---- 4. vantlamamidi file/sheet attribution
console.log("\n=== vantlamamidi attribution (file|sheet : people) ===");
const vAttrib = new Map();
for (const file of FILES) {
  let wb;
  try { wb = XLSX.readFile(file, { cellDates: true, sheetRows: 20000 }); } catch (e) { continue; }
  for (const sname of wb.SheetNames) {
    if (/shg\s*gatherer/i.test(sname)) continue;
    const ws = wb.Sheets[sname];
    if (!ws) continue;
    let rows;
    try { rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, range: realExtent(ws) }); } catch (e) { continue; }
    if (!rows || rows.length < 2) continue;
    let hIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const ks = (rows[i] || []).map((h) => norm(h).toLowerCase());
      if (ks.includes("nameoftribal")) { hIdx = i; break; }
    }
    if (hIdx < 0) continue;
    const cols = {};
    rows[hIdx].forEach((h, i) => { const k = norm(h).toLowerCase(); if (["nameoftribal","nameofproposedvdvk"].includes(k)) cols[k] = i; });
    if (cols.nameofproposedvdvk === undefined) continue;
    for (let r = hIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const p = row[cols.nameofproposedvdvk] != null ? String(row[cols.nameofproposedvdvk]).trim() : "";
      if (!/vantlam|vantalam|vantalam|vantalam/i.test(p)) continue;
      const k = `${basename(file)} | ${sname} | "${p}"`;
      vAttrib.set(k, (vAttrib.get(k) || 0) + 1);
    }
  }
}
for (const [k, c] of [...vAttrib.entries()].sort((x, y) => y[1] - x[1])) console.log(`  ${c, 5}  ${k}`);

// ---- 5. VELUGU file header scan
console.log("\n=== VELUGU / NGO file header scan (rows 1..15) ===");
for (const f of FILES) {
  if (!/PEDAKODAPALLI.*(NGO|VELUGU)/i.test(basename(f))) continue;
  const wb = XLSX.readFile(f, { sheetRows: 30 });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, range: realExtent(ws) });
  console.log(`\n${basename(f)} sheet=${wb.SheetNames[0]} totalRows=${rows.length}`);
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = (rows[i] || []).filter((c) => c != null && String(c).trim() !== "");
    if (cells.length >= 3) console.log(`  row${i + 1} (${cells.length} cells): ${cells.slice(0, 6).map((c) => String(c).slice(0, 22)).join(" | ")}`);
  }
}
