/**
 * reset-schema.ts — drop every application table from Turso so that
 * `npm run db:push` can recreate the whole schema from src/db/schema.
 *
 * DESTRUCTIVE: erases all data. Companion to `db:push` ("fresh push");
 * reseed afterwards with `npm run db:seed` (+ the member loader).
 *
 * Keeps drizzle bookkeeping tables (__drizzle_migrations, sqlite_sequence).
 *
 * Usage: npx tsx scripts/reset-schema.ts --yes
 */
import { config } from "dotenv";
config();
import { createClient, type Client } from "@libsql/client";

const KEEP = new Set(["__drizzle_migrations", "sqlite_sequence", "sqlite_stat1"]);

async function listTables(db: Client): Promise<string[]> {
  const r = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  return r.rows.map((row) => String(row.name)).filter((n) => !KEEP.has(n));
}

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("Refusing to run without --yes (drops every application table + all data).");
    process.exit(1);
  }
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL is required");
  const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });

  // Try to disable FK enforcement for the drops (server may ignore this —
  // if so we fall back to retry-until-progress-stops below).
  let fkOff = false;
  try {
    await db.execute("PRAGMA foreign_keys=off");
    const r = await db.execute("PRAGMA foreign_keys");
    fkOff = Number(r.rows[0]?.["foreign_keys"] ?? 1) === 0;
  } catch {
    /* pragma not supported */
  }

  let tables = await listTables(db);
  console.log(`Dropping ${tables.length} tables (FK enforcement ${fkOff ? "off" : "on → child-first retries"})…`);

  // Retry loop: drop whatever we can each pass; FK-blocked tables defer to the
  // next pass. Stops when a pass makes no progress (then we report and fail).
  let dropped = 0;
  while (tables.length > 0) {
    const remaining: string[] = [];
    let progress = false;
    for (const t of tables) {
      try {
        await db.execute(`DROP TABLE "${t}"`);
        dropped++;
        progress = true;
        console.log(`  - dropped ${t}`);
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (/FOREIGN KEY constraint failed/i.test(msg)) remaining.push(t);
        else throw new Error(`Failed to drop ${t}: ${msg}`);
      }
    }
    tables = remaining;
    if (!progress) {
      throw new Error(`Could not drop (FK-blocked): ${tables.join(", ")}`);
    }
  }

  console.log(`\nOK — ${dropped} tables dropped. Run \`npm run db:push\` to recreate the schema.`);
  db.close();
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
