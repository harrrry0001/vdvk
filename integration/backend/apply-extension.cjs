#!/usr/bin/env node
/**
 * apply-extension.cjs — applies beneficiaries-extension.sql to the database.
 * Same connection pattern as the backend seed (DATABASE_URL + ca.pem).
 *
 *   node apply-extension.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");

const VDVK_BACKEND = path.resolve(__dirname, "..", "..", "vdvk-backend");

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

let pg;
try { pg = require("pg"); }
catch { pg = createRequire(path.join(VDVK_BACKEND, "package.json"))("pg"); }

(async () => {
  // explicit sslmode in the URL wins, then DATABASE_CA_CERT, then local ca.pem
  const urlSsl = (process.env.DATABASE_URL.match(/sslmode=(\w+)/) || [])[1];
  let ssl;
  if (urlSsl === "disable") {
    ssl = false;
  } else if (process.env.DATABASE_CA_CERT) {
    const p = path.resolve(process.env.DATABASE_CA_CERT);
    ssl = fs.existsSync(p) ? { ca: fs.readFileSync(p) } : { rejectUnauthorized: false };
  } else {
    const caPath = [path.join(__dirname, "ca.pem"), path.join(VDVK_BACKEND, "ca.pem")]
      .map(path.resolve).find((p) => fs.existsSync(p));
    ssl = caPath ? { ca: fs.readFileSync(caPath) } : { rejectUnauthorized: false };
  }

  const c = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl,
    connectionTimeoutMillis: 30000,
  });
  await c.connect();
  try {
    const sql = fs.readFileSync(path.join(__dirname, "beneficiaries-extension.sql"), "utf8");
    await c.query(sql);
    const { rows } = await c.query(
      "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'beneficiaries'"
    );
    console.log(`OK — extension applied. beneficiaries now has ${rows[0].n} columns.`);
    console.log("Next: sync the Drizzle schema (see CHANGES.md) and run the loader.");
  } catch (e) {
    console.error("ERROR:", e.message.split("\n")[0]);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
})();
