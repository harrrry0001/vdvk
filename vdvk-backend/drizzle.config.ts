import { defineConfig } from "drizzle-kit";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const caPath = resolve(process.env.DATABASE_CA_CERT ?? "ca.pem");
const baseUrl = process.env.DATABASE_URL!;
// drizzle-kit's pg driver only honors SSL options embedded in the URL
// (pg-connection-string reads sslmode/sslrootcert and loads the CA itself).
const url = existsSync(caPath)
  ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}sslmode=verify-full&sslrootcert=${encodeURIComponent(caPath)}`
  : `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}sslmode=require`;

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
