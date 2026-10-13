// probe-ngo2.mjs — track NGO file people by aadhaar (authoritative identity)
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const HERE = dirname(fileURLToPath(import.meta.url));

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// NGO aadhaar set
const p = join(HERE, "..", "data", "raw", "Pedabayalu", "Pedabayalu", "PEDAKODAPALLI VDVK MEMBER DATA FINAL NGO.xls");
const wb = XLSX.readFile(p, { sheetRows: 400, cellDates: true });
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: null });
const aad = new Map(); // aadhaar -> name
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  if (!r || !r[1]) continue;
  const a = r[7] != null ? String(r[7]).replace(/\.0$/, "").trim() : "";
  if (/^\d{12}$/.test(a)) aad.set(a, String(r[1]).trim());
}
console.log("NGO rows with valid aadhaar:", aad.size);

// search members-full + members-unmatched for those aadhaar
const full = parseCSV(readFileSync(join(HERE, "..", "data", "members-full.csv"), "utf8"));
const fh = full[0], fc = Object.fromEntries(fh.map((h, i) => [h, i]));
const unq = parseCSV(readFileSync(join(HERE, "..", "data", "members-unmatched.csv"), "utf8"));
const uh = unq[0], uc = Object.fromEntries(uh.map((h, i) => [h, i]));

const inFull = new Map(); // aadhaar -> vdvkcode|sourcefile
for (const r of full.slice(1)) {
  const a = r[fc.aadhaar];
  if (aad.has(a)) inFull.set(a, `${r[fc.vdvkcode]} | ${r[fc.sourcefile]}`);
}
const inUnq = new Set();
for (const r of unq.slice(1)) if (aad.has(r[uc.aadhaar])) inUnq.add(r[uc.aadhaar]);

console.log(`NGO aadhaar found in output: ${inFull.size}, in unmatched: ${inUnq.size}, missing: ${aad.size - inFull.size - inUnq.size}`);
const dist = new Map();
for (const v of inFull.values()) dist.set(v, (dist.get(v) || 0) + 1);
for (const [k, c] of [...dist.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(4)}  ${k}`);

// sample missing names
let n = 0;
for (const [a, name] of aad) {
  if (inFull.has(a) || inUnq.has(a)) continue;
  if (n++ >= 8) break;
  console.log("  missing:", name, a);
}
