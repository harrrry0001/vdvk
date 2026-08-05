require("dotenv/config");

const TOKEN = process.env.TURSO_AUTH_TOKEN;
const URL = "https://vdvk-gurveer.aws-ap-south-1.turso.io/v2/pipeline";

async function exec(sql) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ type: "execute", stmt: { sql } }] }),
  });
  const data = await res.json();
  if (data.results?.[0]?.type === "error") throw new Error(data.results[0].error.message);
  console.log("OK:", sql.substring(0, 80));
  return data;
}

async function main() {
  // Create fresh simple tables
  await exec("DROP TABLE IF EXISTS test_grades");
  await exec("DROP TABLE IF EXISTS test_commodities");
  await exec("CREATE TABLE test_commodities (code TEXT PRIMARY KEY, name TEXT NOT NULL)");
  await exec("INSERT INTO test_commodities VALUES ('C1','Turmeric')");
  await exec("CREATE TABLE test_grades (code TEXT PRIMARY KEY, commodity_code TEXT NOT NULL REFERENCES test_commodities(code), name TEXT)");
  await exec("INSERT INTO test_grades VALUES ('G1','C1','A')");

  // Check
  await exec("INSERT INTO test_grades VALUES ('G2','C1','B')");
  console.log("\nFK test passed!");

  // Now try the actual tables
  console.log("\n--- Testing actual tables ---");
  await exec("INSERT INTO grades (code,commodity_code,grade_name,effective_from) VALUES ('GRD-TEST','CMD-001','Test','2025-04-01')");
  await exec("DELETE FROM grades WHERE code='GRD-TEST'");
  console.log("Actual grades table also works!");

  // Cleanup
  await exec("DROP TABLE test_grades");
  await exec("DROP TABLE test_commodities");
  console.log("Done.");
}
main().catch(e => console.error("FAIL:", e.message));
