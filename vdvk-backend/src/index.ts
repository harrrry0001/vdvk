import { app } from "./app";

// ─── START ───────────────────────────────────────────────────────────────
const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};

// Node.js server entry (for direct execution)
if (process.env.NODE_ENV !== "test") {
  const { serve } = await import("@hono/node-server");
  serve(app, (info) => {
    console.log(`VDVK MIS Backend running on http://localhost:${info.port}`);
  });
}
