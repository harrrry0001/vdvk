import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import * as schema from "./schema/index.js";

config();

const uri = process.env.DATABASE_URL;
if (!uri) throw new Error("DATABASE_URL is required");

// Aiven: SSL — CA cert path defaults to ./ca.pem (project root), overridable
// via DATABASE_CA_CERT.
const caPath = resolve(process.env.DATABASE_CA_CERT ?? "ca.pem");
const ssl = existsSync(caPath)
  ? { ca: readFileSync(caPath) }
  : { rejectUnauthorized: false };

const pool = new pg.Pool({
  connectionString: uri,
  ssl,
  max: 10,
  connectionTimeoutMillis: 30000,
});
export const db = drizzle(pool, { schema });
export type Database = typeof db;
