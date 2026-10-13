// diagnose.mjs — quick post-run diagnostics over members-full.csv
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const csv = readFileSync(join(HERE, "..", "data", "members-full.csv"), "utf8");

// minimal CSV parser (handles quotes)
function parse(text) {
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
const rows = parse(csv);
const hdr = rows[0];
const col = Object.fromEntries(hdr.map((h, i) => [h, i]));
const data = rows.slice(1).filter((r) => r.length === hdr.length);

const target = process.argv.slice(2);
if (target.includes("--by-source")) {
  // count by sourcefile for Pedakodapalli-related sources
  const g = new Map();
  for (const r of data) {
    const sf = r[col.sourcefile];
    if (!/PEDAKODAPALLI/i.test(sf)) continue;
    const k = `${sf} | ${r[col.sourcesheet]} | ${r[col.vdvkcode]} | template=${r[col.flags].includes("header-template")}`;
    g.set(k, (g.get(k) || 0) + 1);
  }
  console.log("Pedakodapalli-related rows by file|sheet|code:");
  for (const [k, c] of [...g.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(5)}  ${k}`);
}
if (target.includes("--fat")) {
  for (const code of ["VDK-086", "VDK-095", "VDK-002", "VDK-088", "VDK-083"]) {
    const sub = data.filter((r) => r[col.vdvkcode] === code);
    const noAad = sub.filter((r) => !r[col.aadhaar]).length;
    const weak = sub.filter((r) => r[col.hasincomplete] === "true" && !r[col.aadhaar]).length;
    const src = new Map();
    for (const r of sub) src.set(r[col.sourcefile], (src.get(r[col.sourcefile]) || 0) + 1);
    console.log(`\n${code}: total=${sub.length} no-aadhaar=${noAad} weak=${weak}`);
    for (const [k, c] of [...src.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(c).padStart(5)}  ${k}`);
    // duplicate names within code?
    const names = new Map();
    for (const r of sub) { const n = r[col.name].toUpperCase(); names.set(n, (names.get(n) || 0) + 1); }
    const dupNames = [...names.entries()].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (dupNames.length) console.log(`    dup names: ${dupNames.map(([n, c]) => `${n}x${c}`).join(", ")}`);
  }
}
if (target.includes("--103")) {
  const sub = data.filter((r) => r[col.vdvkcode] === "VDK-103");
  console.log(`VDK-103 rows: ${sub.length}`);
  const g = new Map();
  for (const r of data.filter((r) => /PEDAKODAPALLI/i.test(r[col.sourcefile]))) {
    const k = `${r[col.sourcefile]} | ${r[col.sourcesheet]} -> ${r[col.vdvkcode]}`;
    g.set(k, (g.get(k) || 0) + 1);
  }
  console.log("Pedakodapalli-folder rows by file|sheet->code:");
  for (const [k, c] of [...g.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(5)}  ${k}`);
}
