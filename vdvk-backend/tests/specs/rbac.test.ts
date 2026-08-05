import { describe, expect, it } from "vitest";
import { api } from "../helpers/client.js";
import { tokenFor } from "../helpers/auth.js";

/**
 * Negative tests: unauthenticated (401), wrong-role (403),
 * and tampered tokens must be rejected.
 */
describe("RBAC & AUTH GUARDS", () => {
  it("no token → 401 on protected routes", async () => {
    const paths = [
      "GET /api/master/commodities",
      "GET /api/forms/form1",
      "GET /api/dashboard/commodity-performance",
      "GET /api/mda/stock",
    ];
    for (const p of paths) {
      const [method, path] = p.split(" ");
      const res = await api(method as any, path);
      expect(res.status, `${method} ${path}`).toBe(401);
    }
  });

  it("garbage token → 401", async () => {
    const res = await api("GET", "/api/master/commodities", { token: "not.a.jwt" });
    expect(res.status).toBe(401);
  });

  it("expired token → 401", async () => {
    const jwt = await import("jsonwebtoken");
    const secret = process.env.JWT_SECRET || "vdvk-mis-jwt-secret-change-in-production";
    const expired = jwt.sign({ userId: "USER-X", roles: ["MDA"], activeRole: "MDA" }, secret, { expiresIn: "-1s" });
    const res = await api("GET", "/api/master/commodities", { token: expired });
    expect(res.status).toBe(401);
  });

  it("CC cannot access MDA-only endpoints (403)", async () => {
    const cc = await tokenFor("cc");
    const res = await api("GET", "/api/mda/users", { token: cc });
    expect(res.status).toBe(403);
  });

  it("CC cannot POST /mda/rates (403)", async () => {
    const cc = await tokenFor("cc");
    const res = await api("POST", "/api/mda/rates", { token: cc, body: { commodityCode: "CMD-001" } });
    expect(res.status).toBe(403);
  });

  it("CC cannot create Form 5 VDVK (Admin/MDA only) (403)", async () => {
    const cc = await tokenFor("cc");
    const res = await api("POST", "/api/forms/form5", { token: cc, body: { schemeCode: "SCH-001", name: "x" } });
    expect(res.status).toBe(403);
  });

  it("APM cannot create Form 1 (CC only) (403)", async () => {
    const apm = await tokenFor("apm");
    const res = await api("POST", "/api/forms/form1", { token: apm, body: {} });
    expect(res.status).toBe(403);
  });

  it("CC cannot approve Form 1 (APM only) (403)", async () => {
    const cc = await tokenFor("cc");
    const res = await api("PATCH", "/api/forms/form1/anything/approve", { token: cc, body: { approved: true } });
    expect(res.status).toBe(403);
  });

  it("DPM cannot create Form 1 (CC only) (403)", async () => {
    const dpm = await tokenFor("dpm");
    const res = await api("POST", "/api/forms/form1", { token: dpm, body: {} });
    expect(res.status).toBe(403);
  });

  it("CC cannot verify Form 8 (APM only) (403)", async () => {
    const cc = await tokenFor("cc");
    const res = await api("PATCH", "/api/forms/form8/anything/verify", { token: cc, body: { verified: true } });
    expect(res.status).toBe(403);
  });

  it("APM cannot create Form 9 training (DPM only) (403)", async () => {
    const apm = await tokenFor("apm");
    const res = await api("POST", "/api/forms/form9", { token: apm, body: {} });
    expect(res.status).toBe(403);
  });

  it("APM cannot approve Form 7 machinery (DPM only) (403)", async () => {
    const apm = await tokenFor("apm");
    const res = await api("PATCH", "/api/forms/form7/anything/approve", { token: apm, body: { approved: true } });
    expect(res.status).toBe(403);
  });

  it("hubsup cannot access fund-monitoring dashboard (PO/DPM only) (403)", async () => {
    const hubsup = await tokenFor("hubsup");
    const res = await api("GET", "/api/dashboard/fund-monitoring", { token: hubsup });
    expect(res.status).toBe(403);
  });

  it("CC cannot access audit-trail (PO/DPM/Admin/MDA only) (403)", async () => {
    const cc = await tokenFor("cc");
    const res = await api("GET", "/api/mda/audit-trail", { token: cc });
    expect(res.status).toBe(403);
  });

  it("CC cannot manage users (403)", async () => {
    const cc = await tokenFor("cc");
    const res = await api("POST", "/api/mda/users", { token: cc, body: { name: "x", username: "x", password: "x", roles: [] } });
    expect(res.status).toBe(403);
  });

  it("unknown route → 404 (authenticated)", async () => {
    const mda = await tokenFor("mda");
    const res = await api("GET", "/api/master/does-not-exist", { token: mda });
    expect(res.status).toBe(404);
  });
});
