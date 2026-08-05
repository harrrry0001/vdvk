import { describe, expect, it } from "vitest";
import { expectStatus } from "../helpers/client.js";
import { tokenFor } from "../helpers/auth.js";
import { today, uniq } from "../helpers/ctx.js";
import { app } from "../../src/app.js";

const form1Body = {
  vdvkCode: "VDK-001", vdvkNameSnapshot: "Rampachodavaram VDVK",
  collectionDate: today(), placeOfSubmission: "VDVK Facility",
  transactionType: "Cash", overallRemarks: "tables-test",
  items: [{
    beneficiaryId: "BEN-001", beneficiaryNameSnapshot: "Ramu",
    commodityCode: "CMD-001", commodityNameSnapshot: "Turmeric",
    gradeCode: "GRD-001", gradeNameSnapshot: "A",
    unit: "Kg", unitSnapshot: "Kg",
    qtyKg: 5, qtyPieces: null, ratePerKg: 120, ratePerPiece: null,
    rateSnapshot: "120", totalCost: 600, remarks: null,
  }],
};

function csvUpload(path: string, token: string, csv: string, name: string) {
  const fd = new FormData();
  fd.append("file", new File([csv], name, { type: "text/csv" }));
  return app.request(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
}

describe("TABLE USAGE: movement log, packaging, facility maps, ben-commodities, transfer history, villages, imports", () => {
  // ─── STOCK MOVEMENT LOG ────────────────────────────────────────────────
  it("MOVEMENTS: form1 approve writes IN movement, viewer returns it", async () => {
    const cc = await tokenFor("cc");
    const apm = await tokenFor("apm");
    const po = await tokenFor("po");

    const created = await expectStatus("POST", "/api/forms/form1", 201, { token: cc, body: form1Body });
    const id = created.body.id;
    await expectStatus("PATCH", `/api/forms/form1/${id}/submit`, 200, { token: cc });
    await expectStatus("PATCH", `/api/forms/form1/${id}/approve`, 200, { token: apm, body: { approved: true } });

    const mv = await expectStatus("GET", "/api/mda/stock/movements", 200, { token: po });
    const rec = mv.body.find((m: any) => m.referenceTxnId === id);
    expect(rec).toBeTruthy();
    expect(rec.movementType).toBe("IN");
    expect(rec.referenceTxnType).toBe("Form1");
    expect(rec.qtyKgChange).toBe(5);
    expect(rec.resultingQtyKg).toBe(5);
    expect(rec.performedBy).toBe("USER-APM");
    expect(rec.commodityName).toBe("Turmeric");

    // filtered by formType
    const filtered = await expectStatus("GET", "/api/mda/stock/movements", 200, { token: po, query: { formType: "Form1" } });
    expect(filtered.body.length).toBeGreaterThan(0);
    expect(filtered.body.every((m: any) => m.referenceTxnType === "Form1")).toBe(true);

    // CC (non-officer) → 403
    await expectStatus("GET", "/api/mda/stock/movements", 403, { token: cc });
  });

  // ─── PACKAGING: FORM 3 + FORM 4 ────────────────────────────────────────
  it("PACKAGING: form3 packaging is persisted and returned in detail", async () => {
    const sup = await tokenFor("hubsup");
    const body = {
      processingLocationCode: "FAC-HUB-001", processingLocationNameSnapshot: "Rampachodavaram Hub",
      processingDate: today(), overallRemarks: "packaging-test",
      items: [{
        vdvkCode: "VDK-001", vdvkNameSnapshot: "Rampachodavaram VDVK",
        beneficiaryId: "BEN-001", beneficiaryNameSnapshot: "Ramu",
        commodityCode: "CMD-001", commodityNameSnapshot: "Turmeric",
        gradeCode: "GRD-001", gradeNameSnapshot: "A",
        unit: "Kg",
        availableStockKg: 50, qtyTakenKg: 10, ratePerKg: 120,
        availableStockPcs: null, qtyTakenPcs: null, ratePerPiece: null,
        finishedKg: 9, finishedPcs: null,
        finalCostPerKg: 150, finalCostPerPiece: null,
        remarks: null,
        packaging: [
          { packetSize: "500g", numberOfPackets: 10, totalQtyKg: 5, totalQtyPieces: null },
          { packetSize: "1kg", numberOfPackets: 4, totalQtyKg: 4, totalQtyPieces: null },
        ],
      }],
    };

    const created = await expectStatus("POST", "/api/forms/form3", 201, { token: sup, body });
    const got = await expectStatus("GET", `/api/forms/form3/${created.body.id}`, 200, { token: sup });
    expect(got.body.items[0].packaging.length).toBe(2);
    expect(got.body.items[0].packaging[0].packetSize).toBe("500g");
    expect(got.body.items[0].packaging[0].numberOfPackets).toBe(10);
    expect(got.body.items[0].packaging[1].totalQtyKg).toBe(4);
  });

  it("PACKAGING: form4 packaging is persisted and returned in detail", async () => {
    const apm = await tokenFor("apm");
    const body = {
      saleLocationCode: "FAC-HBZ-001", saleLocationNameSnapshot: "Chintoor Haat Bazaar",
      saleDate: today(), overallRemarks: "packaging-test",
      items: [{
        customerCode: "CUST-001", customerNameSnapshot: "ABC Traders", customerMobileSnapshot: "9876543210",
        invoiceNo: `INV-${uniq("PKG")}`,
        vdvkCode: "VDK-001", vdvkNameSnapshot: "Rampachodavaram VDVK",
        beneficiaryId: null, beneficiaryNameSnapshot: null,
        productType: "Raw Material",
        commodityCode: "CMD-001", commodityNameSnapshot: "Turmeric",
        gradeCode: "GRD-001", gradeNameSnapshot: "A",
        salesUnit: "Kg",
        availableKg: 50, availablePcs: null,
        packetDetails: "500g packs",
        soldKg: 10, soldPcs: null,
        pricePerKg: 150, pricePerPiece: null,
        remarks: null,
        packaging: [
          { packetSize: "500g", numberOfPackets: 20, totalQty: 10 },
        ],
      }],
    };

    const created = await expectStatus("POST", "/api/forms/form4", 201, { token: apm, body });
    const got = await expectStatus("GET", `/api/forms/form4/${created.body.id}`, 200, { token: apm });
    expect(got.body.items[0].packaging.length).toBe(1);
    expect(got.body.items[0].packaging[0].packetSize).toBe("500g");
    expect(got.body.items[0].packaging[0].totalQty).toBe(10);
  });

  // ─── FACILITY MAPPINGS ─────────────────────────────────────────────────
  it("FACILITY-MAPS: commodity/vdvk/supervisor mappings CRUD + by-vdvk lookup", async () => {
    const mda = await tokenFor("mda");
    const cc = await tokenFor("cc");

    // commodities: replace-all semantics
    await expectStatus("POST", "/api/mda/facilities/FAC-HUB-001/commodities", 200, { token: mda, body: { commodityCodes: ["CMD-001", "CMD-002"] } });
    const cmds = await expectStatus("GET", "/api/mda/facilities/FAC-HUB-001/commodities", 200, { token: cc });
    expect(cmds.body.length).toBe(2);

    // vdvks
    await expectStatus("POST", "/api/mda/facilities/FAC-HUB-001/vdvks", 200, { token: mda, body: { vdvkCodes: ["VDK-001"] } });
    const vdvks = await expectStatus("GET", "/api/mda/facilities/FAC-HUB-001/vdvks", 200, { token: cc });
    expect(vdvks.body.length).toBe(1);
    expect(vdvks.body[0].vdvkCode).toBe("VDK-001");

    // by-vdvk lookup (uses seed mapping too)
    const byVdvk = await expectStatus("GET", "/api/mda/facilities/by-vdvk/VDK-001", 200, { token: cc });
    expect(byVdvk.body.some((f: any) => f.facilityCode === "FAC-HUB-001")).toBe(true);

    // supervisor assignment closes the open one and adds a new one
    const before = (await expectStatus("GET", "/api/mda/facilities/FAC-HUB-001/supervisors", 200, { token: cc })).body;
    await expectStatus("POST", "/api/mda/facilities/FAC-HUB-001/supervisors", 201, { token: mda, body: { supervisorUserId: "USER-HUB-SUP2", supervisorNameSnapshot: "Hub Supervisor 2" } });
    const after = (await expectStatus("GET", "/api/mda/facilities/FAC-HUB-001/supervisors", 200, { token: cc })).body;
    expect(after.length).toBe(before.length + 1);
    expect(after.some((s: any) => s.supervisorUserId === "USER-HUB-SUP2" && s.assignedTo === null)).toBe(true);

    // write endpoints restricted to Admin/MDA
    await expectStatus("POST", "/api/mda/facilities/FAC-HUB-001/commodities", 403, { token: cc, body: { commodityCodes: [] } });
  });

  // ─── BENEFICIARY COMMODITIES ───────────────────────────────────────────
  it("BEN-COMMODITIES: form6 detail returns commodities, PUT replaces them", async () => {
    const mda = await tokenFor("mda");
    const tag = uniq("BC");

    const created = await expectStatus("POST", "/api/forms/form6", 201, {
      token: mda,
      body: { vdvkCode: "VDK-001", name: `${tag} Person`, mandal: "MND-001" },
    });
    const id = created.body.id;

    // initially no commodities
    let got = await expectStatus("GET", `/api/forms/form6/${id}`, 200, { token: mda });
    expect(got.body.commodities.length).toBe(0);

    // PUT with commodities
    await expectStatus("PUT", `/api/forms/form6/${id}`, 200, { token: mda, body: { commodities: ["CMD-001", "CMD-003"] } });
    got = await expectStatus("GET", `/api/forms/form6/${id}`, 200, { token: mda });
    expect(got.body.commodities.map((c: any) => c.commodityCode).sort()).toEqual(["CMD-001", "CMD-003"]);

    // PUT with empty array clears them
    await expectStatus("PUT", `/api/forms/form6/${id}`, 200, { token: mda, body: { commodities: [] } });
    got = await expectStatus("GET", `/api/forms/form6/${id}`, 200, { token: mda });
    expect(got.body.commodities.length).toBe(0);
  });

  // ─── USER TRANSFER HISTORY ─────────────────────────────────────────────
  it("TRANSFER: transfer writes history entries, user detail surfaces them", async () => {
    const mda = await tokenFor("mda");

    const before = await expectStatus("GET", "/api/mda/users/USER-CC", 200, { token: mda });
    const originalVdvk = before.body.vdvkCode || "VDK-001";
    const originalMandal = before.body.mandal || "MND-001";
    const target = originalVdvk === "VDK-001" ? "VDK-002" : "VDK-001";

    const res = await expectStatus("PATCH", "/api/mda/users/USER-CC/transfer", 200, {
      token: mda, body: { vdvkCode: target, reason: "redeployed" },
    });
    const vdvkChange = res.body.changes.find((ch: any) => ch.field === "vdvkCode");
    expect(vdvkChange).toBeTruthy();
    expect(vdvkChange.oldValue).toBe(originalVdvk);
    expect(vdvkChange.newValue).toBe(target);

    const detail = await expectStatus("GET", "/api/mda/users/USER-CC", 200, { token: mda });
    const h = detail.body.transferHistory.find((x: any) => x.changedField === "vdvkCode" && x.newValue === target);
    expect(h).toBeTruthy();
    expect(h.oldValue).toBe(originalVdvk);
    expect(h.reason).toBe("redeployed");
    expect(h.changedBy).toBe("USER-MDA");

    // no-op transfer → no history entries
    const noop = await expectStatus("PATCH", "/api/mda/users/USER-CC/transfer", 200, {
      token: mda, body: { vdvkCode: target },
    });
    expect(noop.body.changes.length).toBe(0);

    // restore to avoid side effects on other specs
    await expectStatus("PATCH", "/api/mda/users/USER-CC/transfer", 200, {
      token: mda, body: { vdvkCode: originalVdvk, mandal: originalMandal },
    });
  });

  // ─── VILLAGES ──────────────────────────────────────────────────────────
  it("VILLAGES: geo endpoint returns seeded villages", async () => {
    const cc = await tokenFor("cc");
    const villages = await expectStatus("GET", "/api/master/geo/villages/MND-001", 200, { token: cc });
    expect(villages.body.length).toBeGreaterThanOrEqual(2);
    expect(villages.body[0].mandalCode).toBe("MND-001");
  });

  // ─── MASTER CSV IMPORT + MIGRATION LOG ─────────────────────────────────
  it("IMPORT: commodity CSV import records migration_log, logs viewer works", async () => {
    const mda = await tokenFor("mda");
    const po = await tokenFor("po");
    const tag = uniq("TCM");

    const csv = [
      "code,name,defaultUnit,unitEffectiveFrom",
      `${tag},Imported Test Commodity,Kg,${today()}`,
      "CMD-001,Duplicate Should Fail,Kg,2025-04-01", // existing PK → failed row
    ].join("\n");

    const res = await csvUpload("/api/import/commodities", mda, csv, "commodities.csv");
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.imported).toBe(1);
    expect(body.failed.length).toBe(1);
    expect(body.failed[0].row).toBe(3);
    expect(body.logId).toBeTruthy();

    // migration log viewer (PO has access)
    const logs = await expectStatus("GET", "/api/import/logs", 200, { token: po });
    const entry = logs.body.find((l: any) => l.id === body.logId);
    expect(entry).toBeTruthy();
    expect(entry.entity).toBe("commodities");
    expect(entry.recordCount).toBe(1);
    expect(entry.migratedBy).toBe("USER-MDA");

    // missing file → 400
    const noFile = await app.request("/api/import/commodities", {
      method: "POST",
      headers: { Authorization: `Bearer ${mda}` },
      body: new FormData(),
    });
    expect(noFile.status).toBe(400);
  });

  it("IMPORT: user CSV import creates users with roles", async () => {
    const mda = await tokenFor("mda");
    const tag = uniq("U");

    const csv = [
      "name,username,password,designation,roles,mandal",
      `${tag} Worker,u${tag.toLowerCase()},Test@123,CC,CC;VDVK Facility Supervisor,MND-001`,
      `Bad User,,x,,CC,`, // missing username → failed row
    ].join("\n");

    const res = await csvUpload("/api/import/users", mda, csv, "users.csv");
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.imported).toBe(1);
    expect(body.failed.length).toBe(1);

    // the imported user can log in with the given password
    const loginRes = await expectStatus("POST", "/api/auth/login", 200, { body: { username: `u${tag.toLowerCase()}`, password: "Test@123" } });
    expect(loginRes.body.user.roles).toContain("CC");
  });
});
