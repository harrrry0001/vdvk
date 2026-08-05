import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

async function runMigrations() {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("DATABASE_URL is required");

  const caPath = resolve(process.env.DATABASE_CA_CERT ?? "ca.pem");
  const ssl = existsSync(caPath)
    ? { ca: readFileSync(caPath) }
    : { rejectUnauthorized: false };

  const client = new pg.Client({ connectionString: uri, ssl });
  await client.connect();
  const db = drizzle(client);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("Migrations complete.");
  await client.end();
  process.exit(0);
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
