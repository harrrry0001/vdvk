import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import { errorHandler } from "./middleware/error-handler";
import { authMiddleware } from "./middleware/auth";
import { auditMiddleware } from "./middleware/audit";
import { authRoutes } from "./routes/auth/auth";
import { masterRoutes } from "./routes/master/index";
import { formRoutes } from "./routes/forms/index";
import { dashboardRoutes } from "./routes/dashboard/index";
import { mdaRoutes } from "./routes/master/mda-crud";
import { notificationRoutes } from "./routes/notifications/index";
import { uploadRoutes } from "./routes/upload/index";
import { settingsRoutes } from "./routes/settings/index";
import { exportRoutes } from "./routes/export/index";
import { importRoutes } from "./routes/import/index";

const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), "uploads");
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  webp: "image/webp", gif: "image/gif", pdf: "application/pdf",
};

function corsOrigins(): string[] {
  const env = process.env.CORS_ORIGINS;
  if (env) return env.split(",").map((s) => s.trim()).filter(Boolean);
  return ["http://localhost:5173", "http://localhost:3000"];
}

export function createApp() {
  const app = new Hono();

  // ─── GLOBAL MIDDLEWARE ─────────────────────────────────────────────
  app.use("*", cors({
    origin: corsOrigins(),
    credentials: true,
  }));
  if (process.env.NODE_ENV !== "test") app.use("*", logger());
  app.onError(errorHandler);

  // ─── PUBLIC ROUTES ─────────────────────────────────────────────────
  app.get("/api/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));
  app.route("/api/auth", authRoutes);

  // ─── STATIC UPLOADS (public — referenced from <img> tags) ──────────
  app.get("/uploads/*", async (c) => {
    const filePath = normalize(c.req.path.slice("/uploads/".length));
    if (filePath.includes("..") || filePath.startsWith("/") || filePath.includes("\\")) {
      return c.json({ error: "Not found" }, 404);
    }
    try {
      const data = await readFile(join(UPLOAD_DIR, filePath));
      const ext = filePath.split(".").pop()?.toLowerCase() || "";
      return c.body(data, 200, { "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream" });
    } catch {
      return c.json({ error: "Not found" }, 404);
    }
  });

  // ─── PROTECTED ROUTES ──────────────────────────────────────────────
  app.use("/api/*", authMiddleware);
  app.use("/api/*", auditMiddleware);

  app.route("/api/master", masterRoutes);
  app.route("/api/forms", formRoutes);
  app.route("/api/dashboard", dashboardRoutes);
  app.route("/api/mda", mdaRoutes);
  app.route("/api/notifications", notificationRoutes);
  app.route("/api/upload", uploadRoutes);
  app.route("/api/settings", settingsRoutes);
  app.route("/api/export", exportRoutes);
  app.route("/api/import", importRoutes);

  // ─── STATIC FRONTEND (SPA) — production only ──────────────────────────
  // On Railway the backend also serves the built React app from
  // vdvk-frontend/dist so /api, /uploads and the SPA share one origin.
  // Locally Vite serves the SPA on :5173 and this dist folder usually
  // doesn't exist, so serveStatic simply falls through (next()).
  const FRONTEND_DIST =
    process.env.FRONTEND_DIST || join(process.cwd(), "..", "vdvk-frontend", "dist");

  // Hashed build assets (/assets/*.js|css|...) and files at the dist root.
  app.use("*", serveStatic({ root: FRONTEND_DIST }));

  // SPA fallback — any other GET (e.g. /login, /dashboard) renders
  // index.html so client-side routing works on deep links. Unknown
  // /api and /uploads paths stay JSON 404s.
  app.get("*", async (c, next) => {
    if (c.req.path.startsWith("/api/") || c.req.path.startsWith("/uploads/")) {
      return c.json({ error: "Not found" }, 404);
    }
    return serveStatic({ root: FRONTEND_DIST, path: "index.html" })(c, next);
  });

  return app;
}

export const app = createApp();
