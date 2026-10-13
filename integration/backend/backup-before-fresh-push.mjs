import { createClient } from "@libsql/client";
import { readFileSync, writeFileSync, appendFileSync, existsSync, unlinkSync } from "node:fs";

const cfg = JSON.parse(readFileSync("D:/1A Gopal/vdvk/integration/backend/turso.json", "utf8"));
const db = createClient({ url: cfg.url, authToken: cfg.authToken });

const OUT = "C:/Users/hs333/AppData/Local/Temp/opencode/backup-turso-2026-10-12.ndjson";
if (existsSync(OUT)) unlinkSync(OUT);

const tables = ["beneficiaries", "beneficiary_commodities", "vdvks", "vdvk_commodities"];
let total = 0;

for (const t of tables) {
  const count = (await db.execute(`SELECT count(*) c FROM ${t}`)).rows[0].c;
  const pageSize = 2000;
  for (let off = 0; off < Number(count); off += pageSize) {
    const r = await db.execute({
      sql: `SELECT * FROM ${t} ORDER BY rowid LIMIT ${pageSize} OFFSET ${off}`,
      args: [],
    });
    for (const row of r.rows) {
      appendFileSync(OUT, JSON.stringify({ __table: t, ...row }) + "\n");
      total++;
    }
  }
  console.log(`${t}: ${count} rows`);
}
console.log(`backed up ${total} rows -> ${OUT} (${(readFileSync(OUT).length / 1048576).toFixed(1)} MB)`);
