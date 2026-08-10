import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { systemConfig, emailTemplates } from "../../db/schema/shared/audit-notification.js";
import { requireRole, HonoEnv } from "../../middleware/auth.js";

export const settingsRoutes = new Hono<HonoEnv>();

// ─── SYSTEM CONFIG ────────────────────────────────────────────────────────
settingsRoutes.get("/config", requireRole("MDA"), async (c) => {
  const rows = await db.select().from(systemConfig).orderBy(systemConfig.key);
  return c.json(rows);
});

settingsRoutes.put("/config/:key", requireRole("MDA"), async (c) => {
  const { key } = c.req.param();
  const body = await c.req.json<{ value: string }>();
  if (typeof body.value !== "string" || body.value.length > 500) {
    return c.json({ error: "value must be a string (max 500 chars)" }, 400);
  }
  const [existing] = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).limit(1);
  if (!existing) return c.json({ error: "Config key not found" }, 404);
  await db.update(systemConfig)
    .set({ value: body.value, updatedAt: new Date().toISOString() })
    .where(eq(systemConfig.key, key));
  const [updated] = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).limit(1);
  return c.json(updated);
});

// ─── EMAIL TEMPLATES ──────────────────────────────────────────────────────
settingsRoutes.get("/templates", requireRole("MDA"), async (c) => {
  const rows = await db.select().from(emailTemplates).orderBy(emailTemplates.templateKey);
  return c.json(rows);
});

settingsRoutes.put("/templates/:id", requireRole("MDA"), async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json<{ subject?: string; bodyHtml?: string }>();
  const [existing] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, Number(id))).limit(1);
  if (!existing) return c.json({ error: "Template not found" }, 404);

  const upd: any = { updatedAt: new Date().toISOString() };
  if (body.subject !== undefined) {
    if (typeof body.subject !== "string" || body.subject.length > 191) return c.json({ error: "subject too long" }, 400);
    upd.subject = body.subject;
  }
  if (body.bodyHtml !== undefined) {
    if (typeof body.bodyHtml !== "string" || body.bodyHtml.length > 1000) return c.json({ error: "bodyHtml too long" }, 400);
    upd.bodyHtml = body.bodyHtml;
  }
  await db.update(emailTemplates).set(upd).where(eq(emailTemplates.id, Number(id)));
  const [updated] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, Number(id))).limit(1);
  return c.json(updated);
});
