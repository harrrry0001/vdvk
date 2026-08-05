import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { db } from "../../db/index";
import { users, userRoles, userSessions } from "../../db/schema/master/user";
import { eq, and } from "drizzle-orm";
import { generateTokens, HonoEnv} from "../../middleware/auth";
import { z } from "zod";
import type { AuthUser } from "../../middleware/auth";
import { authMiddleware } from "../../middleware/auth";

export const authRoutes = new Hono<HonoEnv>();

// ─── LOGIN ───────────────────────────────────────────────────────────────
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  activeRole: z.string().optional(),
});

authRoutes.post("/login", async (c) => {
  const body = loginSchema.parse(await c.req.json());

  const [user] = await db.select().from(users).where(eq(users.username, body.username)).limit(1);
  if (!user) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  // Lockout check
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    return c.json({ error: "Account locked. Try again later." }, 423);
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    const newAttempts = user.failedLoginAttempts + 1;
    const lockedUntil = newAttempts >= 5
      ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
      : null;

    await db.update(users)
      .set({ failedLoginAttempts: newAttempts, lockedUntil })
      .where(eq(users.id, user.id));

    return c.json({ error: "Invalid credentials" }, 401);
  }

  // Reset login attempts on success
  await db.update(users)
    .set({ failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(users.id, user.id));

  // Fetch user roles
  const roles = await db.select().from(userRoles).where(
    and(eq(userRoles.userId, user.id), eq(userRoles.isPrimary, true))
  );
  const roleList = roles.map((r) => r.role);
  const activeRole = body.activeRole || roleList[0];

  if (!roleList.includes(activeRole)) {
    return c.json({ error: `Role "${activeRole}" not assigned to this user` }, 403);
  }

  const authUser: AuthUser = {
    userId: user.id,
    roles: roleList,
    activeRole,
    mandal: user.mandal || undefined,
    vdvkCode: user.vdvkCode || undefined,
    facilityCode: user.facilityCode || undefined,
  };

  const tokens = generateTokens(authUser);

  // Store session — enforce max 3 concurrent
  const existingSessions = await db.select().from(userSessions)
    .where(and(eq(userSessions.userId, user.id), eq(userSessions.isRevoked, false)))
    .orderBy(userSessions.createdAt);

  if (existingSessions.length >= 3) {
    await db.update(userSessions)
      .set({ isRevoked: true })
      .where(eq(userSessions.id, existingSessions[0].id));
  }

  await db.insert(userSessions).values({
    id: uuid(),
    userId: user.id,
    refreshToken: tokens.refreshToken,
    activeRole,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return c.json({
    ...tokens,
    user: {
      id: user.id,
      name: user.name,
      roles: roleList,
      activeRole,
      mandal: user.mandal,
    },
  });
});

// ─── REFRESH TOKEN ───────────────────────────────────────────────────────
authRoutes.post("/refresh", async (c) => {
  const { refreshToken } = await c.req.json<{ refreshToken: string }>();
  if (!refreshToken) return c.json({ error: "Refresh token required" }, 400);

  const [session] = await db.select().from(userSessions)
    .where(and(eq(userSessions.refreshToken, refreshToken), eq(userSessions.isRevoked, false)))
    .limit(1);

  if (!session || new Date(session.expiresAt) < new Date()) {
    return c.json({ error: "Invalid or expired refresh token" }, 401);
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) return c.json({ error: "User not found" }, 401);

  const roles = await db.select().from(userRoles).where(eq(userRoles.userId, user.id));
  const roleList = roles.map((r) => r.role);

  const authUser: AuthUser = {
    userId: user.id,
    roles: roleList,
    activeRole: session.activeRole || roleList[0],
    mandal: user.mandal || undefined,
    vdvkCode: user.vdvkCode || undefined,
    facilityCode: user.facilityCode || undefined,
  };

  const tokens = generateTokens(authUser);

  // Rotate refresh token
  await db.update(userSessions)
    .set({ refreshToken: tokens.refreshToken, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
    .where(eq(userSessions.id, session.id));

  return c.json(tokens);
});

// ─── LOGOUT ──────────────────────────────────────────────────────────────
authRoutes.post("/logout", authMiddleware, async (c) => {
  const user = c.get("user");
  await db.update(userSessions)
    .set({ isRevoked: true })
    .where(eq(userSessions.userId, user.userId));
  return c.json({ success: true });
});

// ─── ME ──────────────────────────────────────────────────────────────────
authRoutes.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  const [dbUser] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    mobile: users.mobile,
    designation: users.designation,
    mandal: users.mandal,
  }).from(users).where(eq(users.id, user.userId)).limit(1);

  return c.json({ ...dbUser, roles: user.roles, activeRole: user.activeRole });
});

// ─── PROFILE EDIT ─────────────────────────────────────────────────────────
authRoutes.patch("/profile", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{ name?: string; mobile?: string; designation?: string }>();
  const [dbUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, user.userId)).limit(1);
  if (!dbUser) return c.json({ error: "User not found" }, 404);

  const upd: any = { updatedAt: new Date().toISOString() };
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim() === "" || body.name.length > 191) return c.json({ error: "Invalid name" }, 400);
    upd.name = body.name.trim();
  }
  if (body.mobile !== undefined) {
    if (typeof body.mobile !== "string" || body.mobile.length > 32) return c.json({ error: "Invalid mobile" }, 400);
    upd.mobile = body.mobile.trim() || null;
  }
  if (body.designation !== undefined) {
    if (typeof body.designation !== "string" || body.designation.length > 191) return c.json({ error: "Invalid designation" }, 400);
    upd.designation = body.designation.trim() || null;
  }
  await db.update(users).set(upd).where(eq(users.id, user.userId));
  return c.json({ success: true, updated: Object.keys(upd).filter((k) => k !== "updatedAt") });
});

// ─── PASSWORD CHANGE ──────────────────────────────────────────────────────
authRoutes.patch("/password", authMiddleware, async (c) => {
  const { currentPassword, newPassword } = await c.req.json<{ currentPassword: string; newPassword: string }>();
  const user = c.get("user");
  const [dbUser] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.userId)).limit(1);
  if (!dbUser) return c.json({ error: "User not found" }, 404);

  const valid = await bcrypt.compare(currentPassword, dbUser.hash);
  if (!valid) return c.json({ error: "Current password is incorrect" }, 401);

  if (newPassword.length < 8) return c.json({ error: "Password must be at least 8 characters" }, 400);

  const newHash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash: newHash, passwordChangedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(users.id, user.userId));

  return c.json({ success: true });
});
