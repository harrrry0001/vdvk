#!/usr/bin/env node
/**
 * validate-login.mjs — validate a username/password pair against the Turso
 * database exactly the way vdvk-backend/src/routes/auth/auth.ts does:
 *   1. select user by username
 *   2. lockedUntil check
 *   3. bcrypt.compare(password, password_hash)
 *   4. primary roles from user_roles (is_primary) + activeRole membership
 *
 * Read-only: does NOT touch failed_login_attempts / locked_until.
 *
 * Usage: node validate-login.mjs [username] [password]
 *        (defaults: po / Vdvk@2025)
 */
const { createRequire } = require("node:module");
const path = require("node:path");
const { connect } = require("./turso-client.cjs");

const VDVK_BACKEND = path.resolve(__dirname, "..", "..", "vdvk-backend");
const bcrypt = createRequire(path.join(VDVK_BACKEND, "package.json"))("bcryptjs");

const username = process.argv[2] || "po";
const password = process.argv[3] || "Vdvk@2025";

(async () => {
  const db = connect();
  const one = async (sql, args = []) => (await db.execute({ sql, args })).rows[0];

  const user = await one("SELECT * FROM users WHERE username = ?", [username]);
  console.log(`login attempt: username="${username}" password="${password}"\n`);
  if (!user) {
    console.log("✗ FAIL step 1: no such user");
    db.close(); process.exit(1);
  }
  console.log(`✓ step 1: user found — id=${user.id} name=${user.name} designation=${user.designation} status=${user.status}`);

  const locked = user.locked_until && new Date(user.locked_until) > new Date();
  console.log(`${locked ? "✗" : "✓"} step 2: ${locked ? `ACCOUNT LOCKED until ${user.locked_until}` : `not locked (failed_login_attempts=${user.failed_login_attempts}, locked_until=${user.locked_until})`}`);
  if (locked) { db.close(); process.exit(1); }

  const valid = await bcrypt.compare(password, user.password_hash);
  console.log(`${valid ? "✓" : "✗"} step 3: bcrypt.compare → ${valid}`);
  if (!valid) { db.close(); process.exit(1); }

  const roles = (await db.execute({
    sql: "SELECT role, is_primary FROM user_roles WHERE user_id = ? ORDER BY is_primary DESC",
    args: [user.id],
  })).rows;
  const roleList = roles.filter((r) => r.is_primary === 1 || r.is_primary === true).map((r) => r.role);
  const activeRole = roleList[0];
  const okRole = roleList.includes(activeRole);
  console.log(`${okRole ? "✓" : "✗"} step 4: primary role(s)=[${roleList.join(", ")}] activeRole="${activeRole}" — all roles: ${roles.map((r) => r.role).join(", ")}`);
  if (!okRole) { db.close(); process.exit(1); }

  console.log(`\n✅ LOGIN OK — ${username} / ${password}  (role: ${activeRole})`);
  db.close();
})();
