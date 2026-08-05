import { describe, expect, it } from "vitest";
import { expectStatus } from "../helpers/client.js";
import { tokenFor } from "../helpers/auth.js";

describe("DASHBOARDS", () => {
  it("GET /dashboard/district-overview (PO/APD/DPM)", async () => {
    const dpm = await tokenFor("dpm");
    const res = await expectStatus("GET", "/api/dashboard/district-overview", 200, { token: dpm });
    expect(res.body).toBeTruthy();
  });

  it("GET /dashboard/commodity-performance", async () => {
    const token = await tokenFor("apm");
    const res = await expectStatus("GET", "/api/dashboard/commodity-performance", 200, { token });
    expect(Array.isArray(res.body.stockByCommodity)).toBe(true);
    expect(res.body.totalSales).toBeTypeOf("number");
  });

  it("GET /dashboard/vdvk-performance", async () => {
    const token = await tokenFor("apm");
    await expectStatus("GET", "/api/dashboard/vdvk-performance", 200, { token });
  });

  it("GET /dashboard/fund-monitoring (PO/DPM)", async () => {
    const dpm = await tokenFor("dpm");
    await expectStatus("GET", "/api/dashboard/fund-monitoring", 200, { token: dpm });
  });

  it("GET /dashboard/requests (APM/DPM/PO)", async () => {
    const dpm = await tokenFor("dpm");
    const res = await expectStatus("GET", "/api/dashboard/requests", 200, { token: dpm });
    expect(res.body).toBeTruthy();
  });

  it("GET /dashboard/machinery-summary", async () => {
    const token = await tokenFor("mda");
    const res = await expectStatus("GET", "/api/dashboard/machinery-summary", 200, { token });
    expect(res.body).toBeTruthy();
  });
});
