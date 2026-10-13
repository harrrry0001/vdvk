import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { config } from "dotenv";
import * as schema from "./schema/index.js";

config();

// Turso (libSQL) is the only database target — see .env.
// Creds: TURSO_DATABASE_URL (+ optional TURSO_AUTH_TOKEN), same shape as
// integration/backend/turso.json.
const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("TURSO_DATABASE_URL is required");

const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
export { client as libsqlClient };
