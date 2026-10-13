import { config } from "dotenv";
config();
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const r = await client.execute("SELECT count(*) AS c FROM beneficiaries");
console.log("OK rows:", r.rows, "url:", process.env.TURSO_DATABASE_URL);
console.log("token length:", process.env.TURSO_AUTH_TOKEN?.length);
