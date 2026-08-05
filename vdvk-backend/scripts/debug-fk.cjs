require("dotenv/config");
const TOKEN = process.env.TURSO_AUTH_TOKEN;
const URL = "https://vdvk-gurveer.aws-ap-south-1.turso.io/v2/pipeline";
async function exec(sql) {
  const res = await fetch(URL, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ requests: [{ type: "execute", stmt: { sql } }] }) });
  const data = await res.json();
  if (data.results?.[0]?.type === "error") throw new Error(data.results[0].error.message);
  if (!data.results?.[0]?.response?.result?.rows) return null;
  return data.results[0].response.result.rows;
}

async function main() {
  // Check which tables exist
  const tables = await exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log("Tables:", tables ? tables.map(r => r.name || r[0]).filter(Boolean).join(", ") : "NONE");

  // Check commodities
  const ci = await exec("PRAGMA table_info(commodities)");
  if (ci) {
    console.log("\nCommodities schema:");
    ci.forEach(r => console.log("  " + (r.name || r[0]) + " " + (r.type || r[1])));
  } else {
    console.log("\nCommodities table does NOT exist!");
  }

  // Check grades
  const gi = await exec("PRAGMA table_info(grades)");
  if (gi) {
    console.log("\nGrades schema:");
    gi.forEach(r => console.log("  " + (r.name || r[0]) + " " + (r.type || r[1])));
  } else {
    console.log("\nGrades table does NOT exist!");
  }

  // Check grades FK
  const gf = await exec("PRAGMA foreign_key_list(grades)");
  if (gf) {
    console.log("\nGrades FKs:");
    gf.forEach(r => console.log("  " + (r.from || r[0]) + " -> " + (r.table || r[1]) + "." + (r.to || r[2])));
  }

  // Try simplest insert
  try {
    await exec("INSERT INTO commodities (code,name,default_unit,unit_effective_from,status) VALUES ('TEST-1','Test','Kg','2025-01-01','Active')");
    console.log("\nCommodity insert OK");
    await exec("INSERT INTO grades (code,commodity_code,grade_name,effective_from) VALUES ('TEST-G1','TEST-1','X','2025-01-01')");
    console.log("Grade insert OK!");
    await exec("DELETE FROM grades WHERE code='TEST-G1'");
    await exec("DELETE FROM commodities WHERE code='TEST-1'");
    console.log("Cleanup OK");
  } catch (e) {
    console.log("\nTest insert failed:", e.message);
  }
}
main().catch(e => console.error(e.message));
