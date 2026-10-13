#!/usr/bin/env node
/**
 * wipe-members.cjs — remove the imported field-data members (and their
 * commodity mappings) so import-members.libsql.cjs can re-load them from
 * scratch.  VDVK masters, the two load-created VDVKs (VDK-107/108) and
 * migration_log are left intact (audit trail).
 *
 * Usage: node wipe-members.cjs
 */
const { connect } = require("./turso-client.cjs");

(async () => {
  const db = connect();
  const a = await db.execute("DELETE FROM beneficiary_commodities");
  const b = await db.execute("DELETE FROM beneficiaries");
  console.log(`removed ${a.rowsAffected} beneficiary_commodities, ${b.rowsAffected} beneficiaries`);
  db.close();
})();
