import { defineConfig } from "drizzle-kit";
import "dotenv/config";

// Turso (libSQL) — drizzle-kit's sqlite/turso driver.
// `npm run db:push` diffs src/db/schema against the live Turso database.
const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("TURSO_DATABASE_URL is required");

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  driver: "turso",
  dbCredentials: {
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
