import { v4 as uuid } from "uuid";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { notifications } from "../db/schema/shared/audit-notification.js";
import { users, userRoles } from "../db/schema/master/user.js";

interface NotifyOpts {
  type: string;
  title: string;
  body: string;
  relatedTransactionId?: string;
}

/** Insert an in-app notification for a single user. Never throws. */
export async function notifyUser(userId: string, opts: NotifyOpts): Promise<void> {
  try {
    await db.insert(notifications).values({
      id: uuid(),
      recipientUserId: userId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      relatedTransactionId: opts.relatedTransactionId,
    });
  } catch {
    // Notifications must never break the API
  }
}

/** Notify every active user holding the given role. Never throws. */
export async function notifyRole(role: string, opts: NotifyOpts): Promise<void> {
  try {
    const rows = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .innerJoin(users, eq(users.id, userRoles.userId))
      .where(and(eq(userRoles.role, role), eq(users.status, "Active")));
    for (const r of rows) await notifyUser(r.userId, opts);
  } catch {
    // Notifications must never break the API
  }
}
