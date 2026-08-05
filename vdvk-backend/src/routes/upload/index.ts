import { Hono } from "hono";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { HonoEnv } from "../../middleware/auth.js";

export const uploadRoutes = new Hono<HonoEnv>();

const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED = new Map([
  ["jpg", "image/jpeg"], ["jpeg", "image/jpeg"], ["png", "image/png"],
  ["webp", "image/webp"], ["gif", "image/gif"], ["pdf", "application/pdf"],
]);

// ─── UPLOAD ───────────────────────────────────────────────────────────────
uploadRoutes.post("/", async (c) => {
  const fd = await c.req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return c.json({ error: "Missing file field" }, 400);
  if (file.size === 0) return c.json({ error: "Empty file" }, 400);
  if (file.size > MAX_BYTES) return c.json({ error: "File too large (max 10 MB)" }, 413);

  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED.has(ext)) {
    return c.json({ error: "Unsupported file type (jpg, jpeg, png, webp, gif, pdf only)" }, 400);
  }

  const name = `${randomUUID()}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));

  return c.json({ url: `/uploads/${name}`, name, size: file.size, contentType: ALLOWED.get(ext) }, 201);
});
