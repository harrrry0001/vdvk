#!/usr/bin/env node
/**
 * Read-only probe of the Turso (libSQL) database: tables, row counts,
 * key table schemas. Nothing is written.
 *
 * Usage: node probe-turso.mjs
 * Creds come from ./turso.json  { "url": "libsql://...", "authToken": "..." }
 * or TURSO_DATABASE_URL / TURSO_AUTH_TOKEN env vars.
 */
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const cfgPath = path.join(HERE, "turso.json");
const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, "utf8")) : {};

const url = process.env.TURSO_DATABASE_URL || cfg.url;
const authToken = process.env.TURSO_AUTH_TOKEN || cfg.authToken;
if (!url) {
  console.error("No Turso URL. Provide turso.json or TURSO_DATABASE_URL.");
  process.exit(1);
}

const db = createClient({ url, authToken });

console.log(`Connected: ${url}`);

const t = await db.execute(
  `SELECT name, type FROM sqlite_master
   WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'
   ORDER BY type, name`
);
console.log(`\nObjects (${t.rows.length}):`);
for (const r of t.rows) console.log(`  ${r.type}\t${r.name}`);

const tables = t.rows.filter((r) => r.type === "table").map((r) => String(r.name));

console.log("\nRow counts:");
for (const name of tables) {
  try {
    const c = await db.execute({ sql: `SELECT count(*) AS n FROM "${name}"` });
    console.log(`  ${String(c.rows[0].n).padStart(8)}  ${name}`);
  } catch (e) {
    console.log(`  (error)  ${name}: ${e.message}`);
  }
}

const interesting = ["beneficiaries", "vdvks", "users", "migrations", "migration_log"];
for (const name of interesting) {
  if (!tables.includes(name)) continue;
  const cols = await db.execute({
    sql: `SELECT name, type, "notnull", pk FROM pragma_table_info(?)`,
    args: [name],
  });
  console.log(`\nSchema ${name} (${cols.rows.length} cols):`);
  console.log(
    "  " +
      cols.rows
        .map((r) => `${r.name}:${r.type}${r.pk ? " PK" : ""}${r.notnull ? "" : "?"}`)
        .join(", ")
  );
  const sample = await db.execute({ sql: `SELECT * FROM "${name}" LIMIT 2` });
  for (const row of sample.rows) {
    const o = {};
    for (const [k, v] of Object.entries(row)) {
      const s = String(v);
      o[k] = s.length > 60 ? s.slice(0, 57) + "..." : s;
    }
    console.log("  sample:", JSON.stringify(o));
  }
}
console.log("\nProbe complete (read-only).");
