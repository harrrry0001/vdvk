#!/usr/bin/env node
/**
 * apply-extension-libsql.cjs — apply the field-data beneficiary extension to
 * the Turso (libSQL/SQLite) database.
 *
 * SQLite has no `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` / `COMMENT ON`, so
 * columns are added one at a time after a pragma_table_info check.  Also
 * ensures the repo's canonical indexes exist (pragma check + CREATE INDEX IF
 * NOT EXISTS) and repairs beneficiary_count with the authoritative rule
 * (count of members whose status is not 'Rejected').
 *
 * Usage: node apply-extension-libsql.cjs
 * Idempotent — safe to re-run.
 */
const { connect, bindAll } = require("./turso-client.cjs");

const EXT_COLUMNS = [
  ["reference_id", "TEXT"],    // source REFERENCE ID (batch id in field sheets)
  ["date_of_birth", "TEXT"],   // ISO yyyy-mm-dd when present
  ["shg_name", "TEXT"],
  ["tribe", "TEXT"],
  ["education", "TEXT"],
  ["occupation", "TEXT"],
  ["bank_name", "TEXT"],
  ["ifsc", "TEXT"],
  ["account_number", "TEXT"],
  ["financial_year", "TEXT"],  // e.g. 2024-25
  ["gram_panchayat", "TEXT"],
  ["import_flags", "TEXT"],    // converter flags (ctx-mismatch, header-template, ...)
  ["source_file", "TEXT"],     // provenance: originating workbook
  ["source_sheet", "TEXT"],    // provenance: originating sheet
  ["proposed_vdvk", "TEXT"],   // raw "Name of Proposed VDVK" value
];

// canonical indexes from src/db/schema (repo) — created when missing
const INDEXES = [
  ["beneficiaries", "idx_ben_vdvk", "CREATE INDEX IF NOT EXISTS idx_ben_vdvk ON beneficiaries(vdvk_code)"],
  ["beneficiaries", "idx_ben_mandal", "CREATE INDEX IF NOT EXISTS idx_ben_mandal ON beneficiaries(mandal)"],
  ["beneficiaries", "idx_ben_status", "CREATE INDEX IF NOT EXISTS idx_ben_status ON beneficiaries(status)"],
  ["beneficiaries", "uq_aadhaar",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_aadhaar ON beneficiaries(aadhaar) WHERE aadhaar IS NOT NULL"],
  ["vdvks", "idx_vdvks_scheme", "CREATE INDEX IF NOT EXISTS idx_vdvks_scheme ON vdvks(scheme_code)"],
  ["vdvks", "idx_vdvks_mandal", "CREATE INDEX IF NOT EXISTS idx_vdvks_mandal ON vdvks(mandal)"],
  ["vdvks", "idx_vdvks_status", "CREATE INDEX IF NOT EXISTS idx_vdvks_status ON vdvks(status)"],
  ["vdvks", "uq_vdvk_scheme_mandal",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_vdvk_scheme_mandal ON vdvks(scheme_code, mandal, name)"],
  ["vdvk_commodities", "idx_vdvk_commodities_vdvk",
    "CREATE INDEX IF NOT EXISTS idx_vdvk_commodities_vdvk ON vdvk_commodities(vdvk_code)"],
  ["beneficiary_commodities", "idx_ben_commodities_ben",
    "CREATE INDEX IF NOT EXISTS idx_ben_commodities_ben ON beneficiary_commodities(beneficiary_id)"],
];

(async () => {
  const db = connect();
  console.log("=== VDVK beneficiaries extension (libSQL) ===\n");

  const info = (t) => db.execute({ sql: `SELECT name FROM pragma_table_info(?)`, args: [t] });
  const cols = new Set((await info("beneficiaries")).rows.map((r) => r.name));
  console.log(`beneficiaries columns before: ${cols.size}`);

  const tx = await db.transaction("write");
  try {
    let added = 0;
    for (const [name, type] of EXT_COLUMNS) {
      if (cols.has(name)) continue;
      await tx.execute({ sql: `ALTER TABLE beneficiaries ADD COLUMN "${name}" ${type}` });
      console.log(`  + column ${name}`);
      added++;
    }

    // inspect id columns of mapping tables (loader assumes auto-assigned ids)
    for (const t of ["beneficiary_commodities", "vdvk_commodities"]) {
      const idCol = (await tx.execute({
        sql: `SELECT name, type, "notnull", dflt_value FROM pragma_table_info(?) WHERE pk = 1`,
        args: [t],
      })).rows[0];
      console.log(`  ${t}.pk = ${JSON.stringify(idCol)}`);
    }

    // canonical indexes (uq_aadhaar guarded against pre-existing duplicates)
    let idxAdded = 0;
    for (const [table, idxName, ddl] of INDEXES) {
      const existing = new Set(
        (await tx.execute({ sql: `SELECT name FROM pragma_index_list(?)`, args: [table] })).rows.map((r) => r.name)
      );
      if (existing.has(idxName)) continue;
      if (idxName === "uq_aadhaar") {
        const dups = (await tx.execute({
          sql: `SELECT aadhaar FROM beneficiaries WHERE aadhaar IS NOT NULL
                GROUP BY aadhaar HAVING count(*) > 1 LIMIT 1`,
        })).rows;
        if (dups.length) {
          console.log(`  ! skip ${idxName}: duplicate aadhaar exists (${dups[0].aadhaar}…)`);
          continue;
        }
      }
      await tx.execute({ sql: ddl });
      console.log(`  + index ${idxName}`);
      idxAdded++;
    }

    // authoritative beneficiary_count repair (same rule as loader + route)
    await tx.execute({
      sql: `UPDATE vdvks SET beneficiary_count =
              (SELECT count(*) FROM beneficiaries b
                WHERE b.vdvk_code = vdvks.code AND b.status <> 'Rejected')`,
    });

    await tx.commit();
    console.log(`\nOK — ${added} columns added, ${idxAdded} indexes created, beneficiary_count repaired.`);
  } catch (e) {
    await tx.rollback().catch(() => {});
    console.error("ERROR:", (e && e.message ? e.message : String(e)).split("\n")[0]);
    process.exitCode = 1;
  } finally {
    db.close();
  }
})();
