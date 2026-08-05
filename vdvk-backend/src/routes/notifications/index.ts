import { Hono } from "hono";
import { eq, and, desc, asc, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { notifications } from "../../db/schema/shared/audit-notification.js";
import { HonoEnv } from "../../middleware/auth.js";

export const notificationRoutes = new Hono<HonoEnv>();

// ─── MY NOTIFICATIONS (paginated, unread first) ──────────────────────────
notificationRoutes.get("/", async (c) => {
  const user = c.get("user");
  const { page = "1", limit = "20" } = c.req.query();
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientUserId, user.userId))
    .orderBy(asc(notifications.isRead), desc(notifications.createdAt))
    .limit(Number(limit))
    .offset((Number(page) - 1) * Number(limit));
  return c.json(rows);
});

// ─── UNREAD COUNT ─────────────────────────────────────────────────────────
notificationRoutes.get("/unread-count", async (c) => {
  const user = c.get("user");
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.recipientUserId, user.userId), eq(notifications.isRead, false)));
  return c.json({ count: Number(row?.count || 0) });
});

// ─── MARK ONE AS READ ─────────────────────────────────────────────────────
notificationRoutes.patch("/:id/read", async (c) => {
  const user = c.get("user");
  const { id } = c.req.param();
  const [r] = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1);
  if (!r || r.recipientUserId !== user.userId) return c.json({ error: "Not found" }, 404);
  if (!r.isRead) {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date().toISOString() })
      .where(eq(notifications.id, id));
  }
  return c.json({ id, isRead: true });
});

// ─── MARK ALL AS READ ─────────────────────────────────────────────────────
notificationRoutes.patch("/read-all", async (c) => {
  const user = c.get("user");
  await db.update(notifications)
    .set({ isRead: true, readAt: new Date().toISOString() })
    .where(and(eq(notifications.recipientUserId, user.userId), eq(notifications.isRead, false)));
  return c.json({ ok: true });
});
