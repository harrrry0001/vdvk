import { describe, expect, it } from "vitest";
import { api, expectStatus } from "../helpers/client.js";
import { tokenFor } from "../helpers/auth.js";
import { today, uniq } from "../helpers/ctx.js";

describe("MDA TOOLS", () => {
  it("GET /mda/stock returns rows filtered by commodity", async () => {
    const mda = await tokenFor("mda");
    const res = await expectStatus("GET", "/api/mda/stock", 200, { token: mda, query: { commodityCode: "CMD-001" } });
    expect(Array.isArray(res.body)).toBe(true);
    for (const row of res.body) {
      expect(row.commodityCode).toBe("CMD-001");
    }
  });

  it("GET /mda/stock filters by facility", async () => {
    const mda = await tokenFor("mda");
    const res = await expectStatus("GET", "/api/mda/stock", 200, { token: mda, query: { facilityCode: "FAC-HUB-001" } });
    for (const row of res.body) {
      expect(row.facilityCode).toBe("FAC-HUB-001");
    }
  });

  it("GET /mda/stock/summary aggregates by commodity", async () => {
    const mda = await tokenFor("mda");
    const res = await expectStatus("GET", "/api/mda/stock/summary", 200, { token: mda });
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /mda/rates/prefill returns current Turmeric Grade A rate (revised to Rs.130 from 01/04/2026)", async () => {
    const mda = await tokenFor("mda");
    const res = await expectStatus("GET", "/api/mda/rates/prefill", 200, {
      token: mda, query: { commodityCode: "CMD-001", gradeCode: "GRD-001" },
    });
    expect(res.body?.ratePerKg).toBe(130);
  });

  it("GET /mda/rates/prefill honours date", async () => {
    const mda = await tokenFor("mda");
    const res = await expectStatus("GET", "/api/mda/rates/prefill", 200, {
      token: mda, query: { commodityCode: "CMD-001", gradeCode: "GRD-001", date: "2025-05-01" },
    });
    expect(res.body?.ratePerKg).toBe(120);
  });

  it("GET /mda/rates/prefill missing commodityCode → 400", async () => {
    const mda = await tokenFor("mda");
    const res = await api("GET", "/api/mda/rates/prefill", { token: mda });
    expect(res.status).toBe(400);
  });

  it("GET /mda/rates/prefill unknown commodity → null (200)", async () => {
    const mda = await tokenFor("mda");
    const res = await expectStatus("GET", "/api/mda/rates/prefill", 200, {
      token: mda, query: { commodityCode: "CMD-XXXX" },
    });
    expect(res.body).toBeNull();
  });

  it("POST + PUT /mda/rates (create + revise)", async () => {
    const mda = await tokenFor("mda");
    // Fresh commodity + grade so lookups are deterministic (avoid seeded rows)
    const cmd = uniq("CMD");
    await expectStatus("POST", "/api/mda/commodities", 201, { token: mda, body: { code: cmd, name: `RateTest ${cmd}`, defaultUnit: "Kg" } });
    const grd = uniq("GRD");
    await expectStatus("POST", "/api/mda/grades", 201, { token: mda, body: { code: grd, commodityCode: cmd, gradeName: "T" } });

    const created = await expectStatus("POST", "/api/mda/rates", 201, {
      token: mda,
      body: { commodityCode: cmd, gradeCode: grd, unit: "Kg", ratePerKg: 999, effectiveFrom: today() },
    });
    expect(created.body.created).toBe(true);

    // prefill picks the new rate
    let pre = await expectStatus("GET", "/api/mda/rates/prefill", 200, {
      token: mda, query: { commodityCode: cmd, gradeCode: grd },
    });
    expect(pre.body?.ratePerKg).toBe(999);

    // locate the created row
    const all = await expectStatus("GET", "/api/mda/rates/all", 200, { token: mda });
    const row = all.body.find((r: any) => r.commodityCode === cmd && r.gradeCode === grd && r.ratePerKg === 999);
    expect(row).toBeTruthy();

    // revise → old row closed, new row active with 888
    const revised = await expectStatus("PUT", `/api/mda/rates/${row.id}/revise`, 200, {
      token: mda, body: { ratePerKg: 888 },
    });
    expect(revised.body.revised).toBe(true);

    pre = await expectStatus("GET", "/api/mda/rates/prefill", 200, {
      token: mda, query: { commodityCode: cmd, gradeCode: grd },
    });
    expect(pre.body?.ratePerKg).toBe(888);

    const after = await expectStatus("GET", "/api/mda/rates/all", 200, { token: mda });
    const oldRow = after.body.find((r: any) => r.id === row.id);
    expect(oldRow.effectiveTo).toBeTruthy();
  });

  it("MDA CRUD: commodities full lifecycle", async () => {
    const mda = await tokenFor("mda");
    const code = uniq("CMD");
    const created = await expectStatus("POST", "/api/mda/commodities", 201, {
      token: mda, body: { code, name: `Test Commodity ${code}`, defaultUnit: "Kg" },
    });
    expect(created.body.code).toBe(code);

    const list = await expectStatus("GET", "/api/mda/commodities", 200, { token: mda });
    expect(list.body.some((c: any) => c.code === code)).toBe(true);

    await expectStatus("PUT", `/api/mda/commodities/${code}`, 200, { token: mda, body: { name: "Renamed" } });
    await expectStatus("DELETE", `/api/mda/commodities/${code}`, 200, { token: mda });
  });

  it("MDA CRUD: grades, schemes, exp-heads, customers, suppliers create", async () => {
    const mda = await tokenFor("mda");
    const cases: Array<[string, any]> = [
      ["grades", { commodityCode: "CMD-001", gradeName: `T${uniq("G")}` }],
      ["schemes", { name: `Test Scheme ${uniq("SCH")}` }],
      ["expenditure-heads", { name: `Test ExpHead ${uniq("EXP")}` }],
      ["customers", { name: `Test Customer ${uniq("CUST")}`, mobile: "9000000000" }],
      ["suppliers", { name: `Test Supplier ${uniq("SUP")}`, mobile: "9000000001" }],
    ];
    for (const [entity, payload] of cases) {
      const res = await api("POST", `/api/mda/${entity}`, { token: mda, body: payload });
      expect([200, 201]).toContain(res.status);
      expect(res.body.code || res.body[Object.keys(res.body).find(k => k.endsWith("Code"))!]).toBeTruthy();
    }
  });

  it("USER MANAGEMENT: create → reset-password → transfer → deactivate", async () => {
    const mda = await tokenFor("mda");
    const username = `test_${Date.now()}`;
    const created = await expectStatus("POST", "/api/mda/users", 201, {
      token: mda,
      body: { name: "Test User", username, password: "Test@1234", designation: "CC", mandal: "MND-001", roles: ["CC"] },
    });
    const userId = created.body.id;

    // new user can log in
    const s = await api("POST", "/api/auth/login", { body: { username, password: "Test@1234" } });
    expect(s.status).toBe(200);

    const list = await expectStatus("GET", "/api/mda/users", 200, { token: mda });
    const listed = list.body.find((u: any) => u.id === userId);
    expect(listed).toBeTruthy();
    expect(listed.passwordHash).toBeUndefined();

    await expectStatus("PATCH", `/api/mda/users/${userId}/reset-password`, 200, {
      token: mda, body: { newPassword: "NewPass@123" },
    });
    const loginNew = await api("POST", "/api/auth/login", { body: { username, password: "NewPass@123" } });
    expect(loginNew.status).toBe(200);

    await expectStatus("PATCH", `/api/mda/users/${userId}/transfer`, 200, {
      token: mda, body: { mandal: "MND-002", vdvkCode: "VDK-002", reason: "integration test" },
    });

    await expectStatus("PATCH", `/api/mda/users/${userId}/deactivate`, 200, { token: mda });
  });

  it("GET /mda/audit-trail returns entries (writes happened above)", async () => {
    const mda = await tokenFor("mda");
    const res = await expectStatus("GET", "/api/mda/audit-trail", 200, { token: mda });
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /mda/audit-trail paginates", async () => {
    const mda = await tokenFor("mda");
    const res = await expectStatus("GET", "/api/mda/audit-trail", 200, { token: mda, query: { page: "1", limit: "5" } });
    expect(res.body.length).toBeLessThanOrEqual(5);
  });

  it("MACHINERY TRANSFER: create via form7 → transfer → complete-transfer", async () => {
    const mda = await tokenFor("mda");
    const created = await expectStatus("POST", "/api/forms/form7", 201, {
      token: mda,
      body: { overallRemarks: "transfer-test", items: [{
        name: `Transfer Test Machine ${uniq("MACH")}`,
        commodityMapping: ["CMD-001"],
        currentFacilityCode: "FAC-HUB-001",
        mandal: "MND-001", quantity: 1, unitCost: 50000, totalCost: 50000,
        purchaseDate: today(),
      }] },
    });
    const machId = created.body[0].id;

    // approve so it is a real Available asset (DPM)
    const dpm = await tokenFor("dpm");
    await expectStatus("PATCH", `/api/forms/form7/${machId}/submit`, 200, { token: mda });
    await expectStatus("PATCH", `/api/forms/form7/${machId}/approve`, 200, { token: dpm, body: { approved: true } });

    // transfer → In Transit
    const transfer = await expectStatus("POST", `/api/mda/machinery/${machId}/transfer`, 200, {
      token: mda,
      body: { toFacilityCode: "FAC-HUB-002", toFacilityType: "Hub", reason: "integration test" },
    });
    expect(transfer.body.status).toBe("In Transit");

    // complete → Available at new facility
    const done = await expectStatus("PATCH", `/api/mda/machinery/${machId}/complete-transfer`, 200, {
      token: mda, body: { condition: "Good", remarks: "arrived" },
    });
    expect(done.body.newLocation).toBe("FAC-HUB-002");

    const got = await expectStatus("GET", `/api/forms/form7/${machId}`, 200, { token: mda });
    expect(got.body.currentFacilityCode).toBe("FAC-HUB-002");
    expect(got.body.currentStatus).toBe("Available");

    // completing again → 404 (no active transfer)
    const again = await api("PATCH", `/api/mda/machinery/${machId}/complete-transfer`, { token: mda, body: {} });
    expect(again.status).toBe(404);
  });

  it("GET /mda/facilities/by-type returns hubs", async () => {
    const mda = await tokenFor("mda");
    const res = await expectStatus("GET", "/api/mda/facilities/by-type", 200, { token: mda, query: { type: "Hub" } });
    expect(res.body.some((f: any) => f.code === "FAC-HUB-001")).toBe(true);
  });
});
