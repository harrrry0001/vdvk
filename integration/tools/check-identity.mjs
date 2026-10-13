#!/usr/bin/env node
/**
 * check-identity.mjs — classify in-file identity collisions in members-full.csv
 * (read-only diagnostic for the loader's dedupe rules).
 *
 * Groups rows by P:vdvkcode|norm(name)|gender and reports, for groups with
 * >1 row, whether the rows carry distinct aadhaars (design says KEEP —
 * aadhaar is authoritative) or are true duplicates (skip).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.resolve(HERE, "..", "data", "members-full.csv");
const norm = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

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

const rows = parseCSV(fs.readFileSync(CSV, "utf8"));
const hdr = rows[0];
const idx = (h) => hdr.indexOf(h);
const iV = idx("vdvkcode"), iN = idx("name"), iG = idx("gender"), iA = idx("aadhaar");

const groups = new Map();
let total = 0;
for (const r of rows.slice(1)) {
  if (r.length !== hdr.length) continue;
  total++;
  const g = (r[iG] || "").trim();
  const key = r[iV] + "|" + norm(r[iN]) + "|" + (["Male", "Female", "Other"].includes(g) ? g : "");
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push((r[iA] || "").trim());
}

let dupGroups = 0, keepDistinctAad = 0, skipNoAad = 0, aadDupInGroup = 0;
for (const [, aads] of groups) {
  if (aads.length < 2) continue;
  dupGroups++;
  const withAad = aads.filter((a) => a);
  const distinctAad = new Set(withAad);
  if (distinctAad.size !== withAad.length) aadDupInGroup++; // real duplicate identity
  // rows the loader would keep under the documented rule (fresh aadhaar wins):
  // first occurrence always; later ones only if they carry a not-yet-seen aadhaar
  const seen = new Set();
  let keep = 0, skip = 0;
  for (const a of aads) {
    if (a && !seen.has(a)) { keep++; seen.add(a); }
    else if (!a) { skip++; }
    else skip++; // same aadhaar again
  }
  keepDistinctAad += Math.max(0, keep - 1); // extras beyond the first row
  skipNoAad += skip;
}
console.log(`rows: ${total}, identity groups: ${groups.size}, groups with >1 row: ${dupGroups}`);
console.log(`  extra rows WITH distinct aadhaar (design → KEEP): ${keepDistinctAad}`);
console.log(`  rows skipped (no aadhaar or repeated aadhaar)     : ${skipNoAad}`);
console.log(`  groups containing a repeated aadhaar (true dup)   : ${aadDupInGroup}`);
