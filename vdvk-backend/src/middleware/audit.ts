import type { Context, Next } from "hono";

const AUDITED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function auditMiddleware(c: Context, next: Next) {
  if (!AUDITED_METHODS.has(c.req.method)) {
    return await next();
  }

  const start = Date.now();
  await next();
  const duration = Date.now() - start;

  // Audit logging is performed asynchronously — do not block the response
  const user = c.get("user");
  if (user) {
    const { db } = await import("../db/index.js");
    const { auditTrail } = await import("../db/schema/shared/audit-notification.js");
    const { v4: uuid } = await import("uuid");

    try {
      await db.insert(auditTrail).values({
        id: uuid(),
        transactionId: c.req.url,
        formType: "MasterData",
        action: c.req.method === "POST" ? "CREATED" : "MODIFIED",
        performedBy: user.userId,
        performerRoleSnapshot: user.activeRole,
        performedAt: new Date().toISOString(),
        remarks: `${c.req.method} ${c.req.routePath} (${duration}ms)`,
      });
    } catch {
      // Audit failure must never break the API
    }
  }
}
