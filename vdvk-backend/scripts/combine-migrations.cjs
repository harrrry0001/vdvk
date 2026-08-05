const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "src", "db", "migrations");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();

let combined = "";
for (const f of files) {
  const sql = fs.readFileSync(path.join(dir, f), "utf8");
  // Add breakpoint separator between files
  if (combined) combined += "--> statement-breakpoint\n";
  combined += sql;
}

fs.writeFileSync(path.join(__dirname, "combined-migration.sql"), combined);
console.log(`Combined ${files.length} migrations: ${combined.split("--> statement-breakpoint").length} statements`);
