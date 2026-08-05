import type { Context, Next } from "hono";
import jwt from "jsonwebtoken";

export interface AuthUser {
  userId: string;
  roles: string[];
  activeRole: string;
  mandal?: string;
  vdvkCode?: string;
  facilityCode?: string;
}

export type HonoEnv = {
  Variables: {
    user: AuthUser;
  };
};

export async function authMiddleware(c: Context<HonoEnv>, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const secret = process.env.JWT_SECRET || "vdvk-mis-jwt-secret";
    const payload = jwt.verify(token, secret) as AuthUser;
    c.set("user", payload);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
}

// ─── RBAC HELPER ─────────────────────────────────────────────────────────
export function requireRole(...roles: string[]) {
  return async (c: Context<HonoEnv>, next: Next) => {
    const user = c.get("user");
    const hasRole = user.roles.some((r) => roles.includes(r));
    if (!hasRole) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }
    await next();
  };
}

// ─── TOKEN GENERATION ────────────────────────────────────────────────────
export function generateTokens(user: AuthUser) {
  const secret = process.env.JWT_SECRET || "vdvk-mis-jwt-secret";
  const accessToken = jwt.sign(user, secret, { expiresIn: "15m" });
  // jti makes each refresh token unique — jwt.sign is otherwise deterministic
  // (same payload + same second → identical token), so "rotation" would be a no-op
  const refreshToken = jwt.sign(
    { userId: user.userId, type: "refresh", jti: crypto.randomUUID() },
    secret,
    { expiresIn: "7d" }
  );
  return { accessToken, refreshToken };
}
