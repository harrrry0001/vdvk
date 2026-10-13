/**
 * Shared Turso (libSQL) client for the VDVK integration scripts.
 * Creds: ./turso.json { url, authToken } or TURSO_DATABASE_URL / TURSO_AUTH_TOKEN.
 */
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@libsql/client");

function connect() {
  const cfgPath = path.join(__dirname, "turso.json");
  const cfg = fs.existsSync(cfgPath) ? JSON.parse(fs.readFileSync(cfgPath, "utf8")) : {};
  const url = process.env.TURSO_DATABASE_URL || cfg.url;
  const authToken = process.env.TURSO_AUTH_TOKEN || cfg.authToken;
  if (!url) throw new Error("No Turso URL — provide turso.json or TURSO_DATABASE_URL");
  return createClient({ url, authToken });
}

// libSQL has no boolean type: bind JS booleans as 0/1.
const bind = (v) => (typeof v === "boolean" ? (v ? 1 : 0) : v);
const bindAll = (arr) => arr.map(bind);

module.exports = { connect, bind, bindAll };
