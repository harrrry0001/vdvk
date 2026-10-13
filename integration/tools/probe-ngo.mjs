// probe-ngo.mjs — where did the NGO file's people land?
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const HERE = dirname(fileURLToPath(import.meta.url));

const p = join(HERE, "..", "data", "raw", "Pedabayalu", "Pedabayalu", "PEDAKODAPALLI VDVK MEMBER DATA FINAL NGO.xls");
const wb = XLSX.readFile(p, { sheetRows: 400, cellDates: true });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
const names = [];
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  if (r && r[1] && String(r[1]).trim()) names.push(String(r[1]).trim().toUpperCase());
}
console.log("NGO sheet names:", names.length, "| first3:", names.slice(0, 3).join(" / "));

const csv = readFileSync(join(HERE, "..", "data", "members-full.csv"), "utf8");
const lines = csv.split("\n");
const norm = (s) => String(s).toUpperCase().replace(/[^A-Z]/g, "");
const index = new Map(); // normName -> line
for (const line of lines.slice(1)) {
  const q = line.indexOf('"');
  let nm = "";
  if (q === 0) { const e = line.indexOf('"', 1); nm = line.slice(1, e); }
  else { const c = line.indexOf(","); nm = line.slice(0, c); }
  const key = norm(nm);
  if (!index.has(key)) index.set(key, line);
}

const out = new Map();
let hit = 0;
for (const n of names) {
  const line = index.get(norm(n));
  if (!line) { out.set("NOT-IN-OUTPUT", (out.get("NOT-IN-OUTPUT") || 0) + 1); continue; }
  hit++;
  const sf = line.includes("FINAL NGO.xls") ? "NGO-file"
    : line.includes("RUDAKOTA") ? "RUDAKOTA-file"
    : line.includes("ADUGULA PUTTU") ? "ADUGULA-district"
    : line.includes("VELUGU") ? "VELUGU-file"
    : line.includes("GALAGANDA") ? "GALAGANDA-file"
    : line.includes("GAMAPARAI") ? "GAMAPARAI-file"
    : line.includes("PEDAKODAPALLI") ? "other-PEDAKODAPALLI-file"
    : "other";
  out.set(sf, (out.get(sf) || 0) + 1);
}
console.log("matched-in-output:", hit, "/", names.length);
for (const [k, c] of [...out.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(4)}  ${k}`);
