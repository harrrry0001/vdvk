import { describe, expect, it } from "vitest";
import { api, expectStatus } from "../helpers/client.js";
import { tokenFor } from "../helpers/auth.js";
import { today, tomorrow, uniq } from "../helpers/ctx.js";

/**
 * End-to-end lifecycle tests for Forms 1-12.
 * These create throwaway draft → submitted → approved records in the dev DB.
 */

describe("FORMS 1-12", () => {
  it("FORM 1 (Collection, CC → APM): create → edit → submit → approve", async () => {
    const cc = await tokenFor("cc");
    const apm = await tokenFor("apm");

    const body = {
      vdvkCode: "VDK-001", vdvkNameSnapshot: "Rampachodavaram VDVK",
      collectionDate: today(), placeOfSubmission: "VDVK Facility",
      transactionType: "Cash", overallRemarks: "integration-test",
      items: [{
        beneficiaryId: "BEN-001", beneficiaryNameSnapshot: "Ramu",
        commodityCode: "CMD-001", commodityNameSnapshot: "Turmeric",
        gradeCode: "GRD-001", gradeNameSnapshot: "A",
        unit: "Kg", unitSnapshot: "Kg",
        qtyKg: 10, qtyPieces: null, ratePerKg: 120, ratePerPiece: null,
        rateSnapshot: "120", totalCost: 1200, remarks: null,
      }],
    };

    const created = await expectStatus("POST", "/api/forms/form1", 201, { token: cc, body });
    expect(created.body.status).toBe("Draft");
    const id = created.body.id;

    // invalid payload → 400 (zod)
    const invalid = await api("POST", "/api/forms/form1", { token: cc, body: { vdvkCode: "VDK-001" } });
    expect(invalid.status).toBe(400);

    // edit draft
    await expectStatus("PUT", `/api/forms/form1/${id}`, 200, { token: cc, body: { overallRemarks: "edited" } });

    // fetch by id
    const got = await expectStatus("GET", `/api/forms/form1/${id}`, 200, { token: cc });
    expect(got.body.status).toBe("Draft");
    expect(got.body.items.length).toBe(1);

    // submit (CC) then approve (APM)
    await expectStatus("PATCH", `/api/forms/form1/${id}/submit`, 200, { token: cc });
    const appr = await expectStatus("PATCH", `/api/forms/form1/${id}/approve`, 200, { token: apm, body: { approved: true } });
    expect(appr.body.status).toBe("Approved");

    // list contains it
    const list = await expectStatus("GET", "/api/forms/form1", 200, { token: cc, query: { status: "Approved" } });
    expect(list.body.some((f: any) => f.id === id)).toBe(true);

    // approve again → 400 (not in submitted state)
    const again = await api("PATCH", `/api/forms/form1/${id}/approve`, { token: apm, body: { approved: true } });
    expect(again.status).toBe(400);
  });

  it("FORM 2 (Stock Transfer, Supervisor → APM): create → submit → approve", async () => {
    const sup = await tokenFor("hubsup");
    const apm = await tokenFor("apm");
    const body = {
      transferDate: today(),
      sentFromFacilityCode: "FAC-HUB-001", sentFromNameSnapshot: "Rampachodavaram Hub",
      sentToFacilityCode: "FAC-HUB-002", sentToNameSnapshot: "Maredumilli Hub",
      sentBy: "hubsup", sentByNameSnapshot: "Hub Supervisor",
      overallRemarks: "integration-test",
      items: [{
        vdvkCode: "VDK-001", vdvkNameSnapshot: "Rampachodavaram VDVK",
        beneficiaryId: "BEN-001", beneficiaryNameSnapshot: "Ramu",
        commodityCode: "CMD-001", commodityNameSnapshot: "Turmeric",
        gradeCode: "GRD-001", gradeNameSnapshot: "A",
        goodsType: "Raw", unit: "Kg",
        availableKg: 0, transferQtyKg: 0, availablePieces: null, transferQtyPieces: null,
        ratePerKg: 120, ratePerPiece: null, totalValue: 0,
      }],
    };
    const created = await expectStatus("POST", "/api/forms/form2", 201, { token: sup, body });
    const id = created.body.id;
    await expectStatus("PATCH", `/api/forms/form2/${id}/submit`, 200, { token: sup });
    const appr = await expectStatus("PATCH", `/api/forms/form2/${id}/approve`, 200, { token: apm, body: { approved: true } });
    expect(appr.body.status).toBe("Approved");
  });

  it("FORM 3 (Processing, Supervisor → APM): create → submit → approve", async () => {
    const sup = await tokenFor("hubsup");
    const apm = await tokenFor("apm");
    const body = {
      processingLocationCode: "FAC-HUB-001", processingLocationNameSnapshot: "Rampachodavaram Hub",
      processingDate: today(), overallRemarks: "integration-test",
      items: [{
        vdvkCode: "VDK-001", vdvkNameSnapshot: "Rampachodavaram VDVK",
        beneficiaryId: "BEN-001", beneficiaryNameSnapshot: "Ramu",
        commodityCode: "CMD-001", commodityNameSnapshot: "Turmeric",
        gradeCode: "GRD-001", gradeNameSnapshot: "A",
        unit: "Kg",
        availableStockKg: 0, qtyTakenKg: 0, ratePerKg: 120,
        availableStockPcs: null, qtyTakenPcs: null, ratePerPiece: null,
        finishedKg: 0, finishedPcs: null, finalCostPerKg: 140, finalCostPerPiece: null,
        remarks: null,
      }],
    };
    const created = await expectStatus("POST", "/api/forms/form3", 201, { token: sup, body });
    const id = created.body.id;
    await expectStatus("PATCH", `/api/forms/form3/${id}/submit`, 200, { token: sup });
    const appr = await expectStatus("PATCH", `/api/forms/form3/${id}/approve`, 200, { token: apm, body: { approved: true } });
    expect(appr.body.status).toBe("Approved");
  });

  it("FORM 4 (Sales, APM → DPM): create → submit → approve", async () => {
    const apm = await tokenFor("apm");
    const dpm = await tokenFor("dpm");
    const body = {
      saleLocationCode: "FAC-HUB-001", saleLocationNameSnapshot: "Rampachodavaram Hub",
      saleDate: today(), overallRemarks: "integration-test",
      items: [{
        customerCode: "CUST-001", customerNameSnapshot: "ABC Traders", customerMobileSnapshot: "9876543210",
        invoiceNo: `INV-TEST-${Date.now()}`,
        vdvkCode: "VDK-001", vdvkNameSnapshot: "Rampachodavaram VDVK",
        beneficiaryId: null, beneficiaryNameSnapshot: null,
        productType: "Raw Material",
        commodityCode: "CMD-001", commodityNameSnapshot: "Turmeric",
        gradeCode: "GRD-001", gradeNameSnapshot: "A",
        salesUnit: "Kg",
        availableKg: 0, availablePcs: null,
        packetDetails: null, soldKg: 0, soldPcs: null,
        pricePerKg: 150, pricePerPiece: null, remarks: null,
      }],
    };
    const created = await expectStatus("POST", "/api/forms/form4", 201, { token: apm, body });
    const id = created.body.id;
    await expectStatus("PATCH", `/api/forms/form4/${id}/submit`, 200, { token: apm });
    const appr = await expectStatus("PATCH", `/api/forms/form4/${id}/approve`, 200, { token: dpm, body: { approved: true } });
    expect(appr.body.status).toBe("Approved");
  });

  it("FORM 5 + 6 (VDVK & Beneficiary Registration, Admin → DPM): full lifecycle", async () => {
    const mda = await tokenFor("mda");
    const dpm = await tokenFor("dpm");

    // 5a: create VDVK draft (server generates the code)
    const v = await expectStatus("POST", "/api/forms/form5", 201, {
      token: mda,
      body: {
        schemeCode: "SCH-001", name: `Test VDVK ${uniq("VDK")}`, mandal: "MND-001",
        amountSanctioned: 100000, amountReleased: 50000,
        commodities: ["CMD-001"],
      },
    });
    const vdvkCode = v.body.code as string;
    expect(vdvkCode).toMatch(/^VDK-/);

    // 5b: submit fails without beneficiaries
    const noBen = await api("PATCH", `/api/forms/form5/${vdvkCode}/submit`, { token: mda });
    expect(noBen.status).toBe(400);

    // 6a: register beneficiary
    const b = await expectStatus("POST", "/api/forms/form6", 201, {
      token: mda,
      body: { vdvkCode, name: `Test Beneficiary ${uniq("BEN")}`, age: 30, gender: "Male", mandal: "MND-001", registrationMode: "Individual" },
    });
    expect(b.body.id).toBeTruthy();

    // 6b: beneficiary draft visible in list
    const benList = await expectStatus("GET", "/api/forms/form6", 200, { token: mda, query: { vdvkCode, status: "Draft" } });
    expect(benList.body.some((x: any) => x.id === b.body.id)).toBe(true);

    // 6c: beneficiary submit → DPM approve (increments VDVK beneficiaryCount)
    const benId = b.body.id;
    await expectStatus("PATCH", `/api/forms/form6/${benId}/submit`, 200, { token: mda });
    const benAppr = await expectStatus("PATCH", `/api/forms/form6/${benId}/approve`, 200, { token: dpm, body: { approved: true } });
    expect(benAppr.body.status).toBe("Approved");

    // 5c: submit VDVK now works (has approved beneficiary)
    await expectStatus("PATCH", `/api/forms/form5/${vdvkCode}/submit`, 200, { token: mda });

    // 5d: DPM approves
    const appr = await expectStatus("PATCH", `/api/forms/form5/${vdvkCode}/approve`, 200, { token: dpm, body: { approved: true } });
    expect(appr.body.status).toBe("Approved");

    // 5e: approved VDVK shows in master list
    const masters = await expectStatus("GET", "/api/master/vdvks", 200, { token: mda });
    expect(masters.body.some((x: any) => x.code === vdvkCode)).toBe(true);

    // 6d: approved beneficiary visible in approved list
    const benApproved = await expectStatus("GET", "/api/forms/form6", 200, { token: mda, query: { vdvkCode } });
    expect(benApproved.body.some((x: any) => x.id === benId)).toBe(true);
  });

  it("FORM 7 (Machinery, Admin → DPM): create → submit → approve", async () => {
    const mda = await tokenFor("mda");
    const dpm = await tokenFor("dpm");
    const body = {
      overallRemarks: "integration-test",
      items: [{
        name: `Test Crusher ${uniq("MACH")}`,
        commodityMapping: ["CMD-001"],
        currentFacilityCode: "FAC-HUB-001",
        mandal: "MND-001",
        quantity: 1, unitCost: 100000, totalCost: 100000,
        purchaseDate: today(),
        fundingSource: "PMJVM",
      }],
    };
    const created = await expectStatus("POST", "/api/forms/form7", 201, { token: mda, body });
    const mach = created.body[0];
    expect(mach.status).toBe("Draft");
    expect(mach.id).toMatch(/^MACH-/);

    // list machinery
    const list = await expectStatus("GET", "/api/forms/form7", 200, { token: mda });
    expect(list.body.some((m: any) => m.id === mach.id)).toBe(true);

    // submit → approve
    await expectStatus("PATCH", `/api/forms/form7/${mach.id}/submit`, 200, { token: mda });
    const appr = await expectStatus("PATCH", `/api/forms/form7/${mach.id}/approve`, 200, { token: dpm, body: { approved: true } });
    expect(appr.body.status).toBe("Approved");
  });

  it("FORM 8 (Utilisation, Supervisor → APM): create → submit → verify", async () => {
    const sup = await tokenFor("hubsup");
    const apm = await tokenFor("apm");
    const mda = await tokenFor("mda");

    // f8 items have an FK to machinery.id — create a real machine
    const mach = await expectStatus("POST", "/api/forms/form7", 201, {
      token: mda,
      body: { overallRemarks: "form8-test", items: [{
        name: `Utilisation Machine ${uniq("MACH")}`,
        commodityMapping: ["CMD-001"],
        currentFacilityCode: "FAC-HUB-001",
        mandal: "MND-001", quantity: 1, unitCost: 20000, totalCost: 20000,
        purchaseDate: today(),
      }] },
    });

    const body = {
      processingDate: today(), overallRemarks: "integration-test",
      items: [{
        locationType: "Hub", facilityCode: "FAC-HUB-001", facilityNameSnapshot: "Rampachodavaram Hub",
        vdvkCode: "VDK-001", vdvkNameSnapshot: "Rampachodavaram VDVK",
        machineryId: mach.body[0].id, machineryNameSnapshot: "Utilisation Machine",
        commodityCode: "CMD-001", commodityNameSnapshot: "Turmeric",
        unit: "Kg",
        rawQtyKg: 0, rawQtyPcs: null, packetDetails: null,
        finalOutputKg: 0, finalOutputPcs: null, utilisationHours: 1, remarks: null,
      }],
    };
    const created = await expectStatus("POST", "/api/forms/form8", 201, { token: sup, body });
    const id = created.body.id;
    await expectStatus("PATCH", `/api/forms/form8/${id}/submit`, 200, { token: sup });
    const ver = await expectStatus("PATCH", `/api/forms/form8/${id}/verify`, 200, { token: apm, body: { verified: true } });
    expect(ver.body.status).toBe("Verified");
  });

  it("FORM 9 (Training, DPM only): create → update", async () => {
    const dpm = await tokenFor("dpm");
    const body = {
      trainingDate: today(), trainingTitle: `Test Training ${uniq("TRN")}`,
      trainingType: "Awareness",
      items: [{ vdvkCode: "VDK-001", vdvkNameSnapshot: "Rampachodavaram VDVK", numberOfParticipants: 10, trainingExpense: 5000 }],
    };
    const created = await expectStatus("POST", "/api/forms/form9", 201, { token: dpm, body });
    expect(created.body.id).toBeTruthy();
    const got = await expectStatus("GET", `/api/forms/form9/${created.body.id}`, 200, { token: dpm });
    expect(got.body.items.length).toBe(1);
    await expectStatus("PUT", `/api/forms/form9/${created.body.id}`, 200, { token: dpm, body: { trainingTopic: "updated" } });
  });

  it("FORM 10 (Fund Utilisation, APM → DPM): create → submit → approve", async () => {
    const apm = await tokenFor("apm");
    const dpm = await tokenFor("dpm");
    const body = {
      weekFrom: today(), weekTo: today(), overallRemarks: "integration-test",
      items: [{
        expenditureDate: today(), expenditureHeadCode: "EXP-001", expenditureHeadNameSnapshot: "Logistics & Transportation",
        relatedToVdvk: true, vdvkCodes: ["VDK-001"],
        relatedToLocation: false, locationType: null, locationCodes: null,
        amount: 1000, purpose: "test",
      }],
    };
    const created = await expectStatus("POST", "/api/forms/form10", 201, { token: apm, body });
    const id = created.body.id;
    await expectStatus("PATCH", `/api/forms/form10/${id}/submit`, 200, { token: apm });
    const appr = await expectStatus("PATCH", `/api/forms/form10/${id}/approve`, 200, { token: dpm, body: { approved: true } });
    expect(appr.body.status).toBe("Approved");
  });

  it("FORM 11 (Facility, Admin → DPM): create → submit → approve", async () => {
    const mda = await tokenFor("mda");
    const dpm = await tokenFor("dpm");
    const body = {
      type: "Hub", name: `Test Facility ${uniq("FAC")}`,
      schemeCode: "SCH-001", state: "Andhra Pradesh", district: "Alluri Sitarama Raju", mandal: "MND-001",
      totalFundSanctioned: 500000, totalFundReleased: 200000, totalFundUtilised: 100000,
    };
    const created = await expectStatus("POST", "/api/forms/form11", 201, { token: mda, body });
    expect(created.body.code).toMatch(/^FAC-/);
    const code = created.body.code;
    await expectStatus("PATCH", `/api/forms/form11/${code}/submit`, 200, { token: mda });
    const appr = await expectStatus("PATCH", `/api/forms/form11/${code}/approve`, 200, { token: dpm, body: { approved: true } });
    expect(appr.body.status).toBe("Approved");
    const got = await expectStatus("GET", `/api/forms/form11/${code}`, 200, { token: mda });
    expect(got.body.status).toBe("Approved");
  });

  it("FORM 12 (Field Visit, APM only): create → update", async () => {
    const apm = await tokenFor("apm");
    const body = {
      visitDate: tomorrow(), visitStartTime: "10:00", visitEndTime: "11:00",
      mandal: "MND-001", visitLocationType: "VDVK", locationName: "Rampachodavaram VDVK",
      relatedVdvkCodes: ["VDK-001"], purposeOfVisit: "Integration test visit",
      visitDescription: null, keyObservations: null,
      supportingDocuments: null, remarks: null,
      gpsLatitude: 17.4, gpsLongitude: 81.7,
    };
    const created = await expectStatus("POST", "/api/forms/form12", 201, { token: apm, body });
    expect(created.body.id).toBeTruthy();
    const got = await expectStatus("GET", `/api/forms/form12/${created.body.id}`, 200, { token: apm });
    expect(got.body.purposeOfVisit).toBe("Integration test visit");
    await expectStatus("PUT", `/api/forms/form12/${created.body.id}`, 200, { token: apm, body: { remarks: "updated" } });
  });
});
