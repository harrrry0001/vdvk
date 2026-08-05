import type { Context } from "hono";
import { ZodError } from "zod";

export function errorHandler(err: any, c: Context) {
  if (err instanceof ZodError) {
    return c.json({
      error: "Validation failed",
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    }, 400);
  }

  console.error(`[${new Date().toISOString()}] ${c.req.method} ${c.req.url}:`, err);
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  return c.json({
    error: message,
    status,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  }, status as any);
}
