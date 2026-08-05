import { describe, expect, it } from "vitest";
import { api, expectStatus } from "../helpers/client.js";
import { tokenFor } from "../helpers/auth.js";

describe("MASTER DATA (read-only)", () => {
  let token: string;

  it("auth is available", async () => { token = await tokenFor("cc"); });

  it("GET /geo/states returns AP", async () => {
    const res = await expectStatus("GET", "/api/master/geo/states", 200, { token });
    const ap = res.body.find((s: any) => s.code === "AP");
    expect(ap).toBeTruthy();
  });

  it("GET /geo/districts/:stateCode returns DIST-ASR", async () => {
    const res = await expectStatus("GET", "/api/master/geo/districts/AP", 200, { token });
    expect(res.body.some((d: any) => d.code === "DIST-ASR")).toBe(true);
  });

  it("GET /geo/mandals/:districtCode returns 11 seeded mandals", async () => {
    const res = await expectStatus("GET", "/api/master/geo/mandals/DIST-ASR", 200, { token });
    expect(res.body.length).toBe(11);
    expect(res.body.some((m: any) => m.code === "MND-001")).toBe(true);
  });

  it("GET /geo/villages/:mandalCode returns array (200)", async () => {
    await expectStatus("GET", "/api/master/geo/villages/MND-001", 200, { token });
  });

  it("GET /commodities includes Turmeric (CMD-001)", async () => {
    const res = await expectStatus("GET", "/api/master/commodities", 200, { token });
    const t = res.body.find((c: any) => c.code === "CMD-001");
    expect(t?.name).toBe("Turmeric");
  });

  it("GET /commodities/active-on/:date respects effective dates", async () => {
    const res = await expectStatus("GET", "/api/master/commodities/active-on/2025-05-01", 200, { token });
    expect(res.body.some((c: any) => c.code === "CMD-001")).toBe(true);
  });

  it("GET /grades filters by commodity", async () => {
    const all = await expectStatus("GET", "/api/master/grades", 200, { token });
    expect(all.body.length).toBeGreaterThan(0);
    const filtered = await expectStatus("GET", "/api/master/grades", 200, { token, query: { commodityCode: "CMD-001" } });
    expect(filtered.body.map((g: any) => g.code)).toEqual(expect.arrayContaining(["GRD-001", "GRD-002"]));
    expect(filtered.body.every((g: any) => g.commodityCode === "CMD-001")).toBe(true);
  });

  it("GET /rates returns Turmeric Grade A @ Rs.120/Kg", async () => {
    const res = await expectStatus("GET", "/api/master/rates", 200, {
      token, query: { commodityCode: "CMD-001", gradeCode: "GRD-001" },
    });
    expect(res.body[0]?.ratePerKg).toBe(120);
  });

  it("GET /rates honours date window", async () => {
    const res = await expectStatus("GET", "/api/master/rates", 200, {
      token, query: { commodityCode: "CMD-001", date: "2025-05-01" },
    });
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("GET /schemes returns active schemes", async () => {
    const res = await expectStatus("GET", "/api/master/schemes", 200, { token });
    expect(res.body.some((s: any) => s.code === "SCH-001")).toBe(true);
  });

  it("GET /expenditure-heads excludes processing-only heads", async () => {
    const res = await expectStatus("GET", "/api/master/expenditure-heads", 200, { token });
    const codes = res.body.map((e: any) => e.code);
    expect(codes).toContain("EXP-001");
    expect(codes).not.toContain("EXP-004");
  });

  it("GET /customers returns CUST-001", async () => {
    const res = await expectStatus("GET", "/api/master/customers", 200, { token });
    expect(res.body.some((c: any) => c.code === "CUST-001")).toBe(true);
  });

  it("GET /suppliers returns SUP-001", async () => {
    const res = await expectStatus("GET", "/api/master/suppliers", 200, { token });
    expect(res.body.some((s: any) => s.code === "SUP-001")).toBe(true);
  });

  it("GET /vdvks returns only Approved VDVKs", async () => {
    const res = await expectStatus("GET", "/api/master/vdvks", 200, { token });
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((v: any) => v.status === "Approved")).toBe(true);
    expect(res.body.some((v: any) => v.code === "VDK-001")).toBe(true);
  });

  it("GET /vdvks/:code includes commodities", async () => {
    const res = await expectStatus("GET", "/api/master/vdvks/VDK-001", 200, { token });
    expect(res.body.code).toBe("VDK-001");
    expect(Array.isArray(res.body.commodities)).toBe(true);
  });

  it("GET /vdvks/:code unknown → 404", async () => {
    const res = await api("GET", "/api/master/vdvks/VDK-XXXX", { token });
    expect(res.status).toBe(404);
  });
});
