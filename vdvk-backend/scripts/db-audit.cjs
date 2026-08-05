const { createClient } = require("@libsql/client");
require("dotenv/config");
const c = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function audit() {
  // Get ALL table names properly
  const tables = await c.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IS NOT NULL ORDER BY name"
  );

  const rows = tables.rows.filter(r => r.name != null).map(r => r.name);
  console.log(`${rows.length} tables total\n`);

  const populated = [];
  const empty = [];

  for (const name of rows) {
    const cnt = await c.execute(`SELECT count(*) as cnt FROM [${name}]`);
    const count = Number(cnt.rows[0].cnt);
    if (count > 0) populated.push({ name, count });
    else empty.push(name);
  }

  console.log("=== POPULATED (${populated.length} tables) ===");
  populated.forEach(t => console.log(`  ${t.name.padEnd(35)} ${t.count} rows`));

  console.log(`\n=== EMPTY (${empty.length} tables) ===`);
  empty.forEach(t => console.log(`  ${t.name}`));

  // What's missing from seed
  console.log("\n=== MISSING SEED DATA ===");
  const mappingTables = [
    "vdvk_commodities",
    "facility_vdvk_mapping",
    "facility_supervisors",
    "facility_commodities",
    "beneficiary_commodities",
    "system_config",
  ];
  mappingTables.forEach(t => {
    console.log(`  ${t}: ${empty.includes(t) ? 'EMPTY - needs seeding' : 'OK'}`);
  });

  // Transaction tables (will be populated by workflow, OK to be empty)
  console.log("\n=== TRANSACTION TABLES (populated by user workflow) ===");
  const txTables = rows.filter(r =>
    r.startsWith("form1_") || r.startsWith("form2_") || r.startsWith("form3_") ||
    r.startsWith("form4_") || r.startsWith("form8_") || r.startsWith("form9_") ||
    r.startsWith("form10_") || r.startsWith("form12_") ||
    r === "stock_ledger" || r === "stock_movement_log" ||
    r === "audit_trail" || r === "rejected_records" || r === "notifications" ||
    r === "notification_log" || r === "machinery_transfers"
  );
  txTables.forEach(t => {
    const pop = populated.find(p => p.name === t);
    console.log(`  ${t.padEnd(35)} ${pop ? pop.count + ' rows' : '0 rows (expected)'}`);
  });

  c.close();
}
audit().catch(e => console.error(e.message));
