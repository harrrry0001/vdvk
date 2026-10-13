import { describe, expect, it } from "vitest";
import { api, expectStatus } from "../helpers/client.js";
import { tokenFor } from "../helpers/auth.js";
import { today, uniq } from "../helpers/ctx.js";
import { memberOf } from "../helpers/data.js";
import { app } from "../../src/app.js";

async function form1Body() {
  const ben = await memberOf("VDK-001");
  return {
    vdvkCode: "VDK-001", vdvkNameSnapshot: "Rampachodavaram VDVK",
    collectionDate: today(), placeOfSubmission: "VDVK Facility",
    transactionType: "Cash", overallRemarks: "extras-test",
    items: [{
      beneficiaryId: ben.id, beneficiaryNameSnapshot: ben.name,
      commodityCode: "CMD-001", commodityNameSnapshot: "Turmeric",
      gradeCode: "GRD-001", gradeNameSnapshot: "A",
      unit: "Kg", unitSnapshot: "Kg",
      qtyKg: 5, qtyPieces: null, ratePerKg: 120, ratePerPiece: null,
      rateSnapshot: "120", totalCost: 600, remarks: null,
    }],
  };
}

describe("EXTRAS: upload, notifications, delete", () => {
  // ─── FILE UPLOAD ──────────────────────────────────────────────────────
  it("UPLOAD: accepts image, rejects bad type, serves the file back", async () => {
    const cc = await tokenFor("cc");
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], `test-${uniq("IMG")}.png`, { type: "image/png" }));

    const res = await app.request("/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${cc}` },
      body: fd,
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.url).toMatch(/^\/uploads\/[0-9a-f-]+\.png$/);

    const served = await app.request(body.url);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toContain("image/png");

    // rejected type
    const bad = new FormData();
    bad.append("file", new File(["nope"], "evil.exe", { type: "application/x-msdownload" }));
    const badRes = await app.request("/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${cc}` },
      body: bad,
    });
    expect(badRes.status).toBe(400);

    // unauthenticated → 401
    const anon = await app.request("/api/upload", { method: "POST", body: fd });
    expect(anon.status).toBe(401);
  });

  // ─── NOTIFICATIONS ────────────────────────────────────────────────────
  it("NOTIFICATIONS: submit notifies approver, approve notifies creator, read flow works", async () => {
    const cc = await tokenFor("cc");
    const apm = await tokenFor("apm");

    const created = await expectStatus("POST", "/api/forms/form1", 201, { token: cc, body: await form1Body() });
    const id = created.body.id;

    // CC submits → APM should receive a notification
    await expectStatus("PATCH", `/api/forms/form1/${id}/submit`, 200, { token: cc });

    const unread = await expectStatus("GET", "/api/notifications/unread-count", 200, { token: apm });
    expect(unread.body.count).toBeGreaterThan(0);

    const inbox = await expectStatus("GET", "/api/notifications", 200, { token: apm });
    const sub = inbox.body.find((n: any) => n.relatedTransactionId === id);
    expect(sub).toBeTruthy();
    expect(sub.type).toBe("SUBMITTED");

    // APM approves → CC should receive the approval notification
    await expectStatus("PATCH", `/api/forms/form1/${id}/approve`, 200, { token: apm, body: { approved: true } });
    const ccInbox = await expectStatus("GET", "/api/notifications", 200, { token: cc });
    const appr = ccInbox.body.find((n: any) => n.relatedTransactionId === id);
    expect(appr).toBeTruthy();
    expect(appr.type).toBe("APPROVED");

    // mark one read → unread count drops
    const before = (await expectStatus("GET", "/api/notifications/unread-count", 200, { token: cc })).body.count;
    await expectStatus("PATCH", `/api/notifications/${appr.id}/read`, 200, { token: cc });
    const after = (await expectStatus("GET", "/api/notifications/unread-count", 200, { token: cc })).body.count;
    expect(after).toBe(before - 1);

    // read-all
    await expectStatus("PATCH", "/api/notifications/read-all", 200, { token: cc });
    const ccInbox2 = await expectStatus("GET", "/api/notifications", 200, { token: cc });
    expect(ccInbox2.body.every((n: any) => n.isRead)).toBe(true);
  });

  // ─── DELETE / WITHDRAW DRAFTS ─────────────────────────────────────────
  it("DELETE: creator can delete a draft, not submitted records, not others' records", async () => {
    const cc = await tokenFor("cc");
    const dpm = await tokenFor("dpm");

    // delete a draft → ok, then 404
    const draft = await expectStatus("POST", "/api/forms/form1", 201, { token: cc, body: await form1Body() });
    await expectStatus("DELETE", `/api/forms/form1/${draft.body.id}`, 200, { token: cc });
    await expectStatus("GET", `/api/forms/form1/${draft.body.id}`, 404, { token: cc });

    // someone else's draft → 403
    const other = await expectStatus("POST", "/api/forms/form1", 201, { token: cc, body: await form1Body() });
    await expectStatus("DELETE", `/api/forms/form1/${other.body.id}`, 403, { token: dpm });

    // submitted record → 400
    const submitted = await expectStatus("POST", "/api/forms/form1", 201, { token: cc, body: await form1Body() });
    await expectStatus("PATCH", `/api/forms/form1/${submitted.body.id}/submit`, 200, { token: cc });
    await expectStatus("DELETE", `/api/forms/form1/${submitted.body.id}`, 400, { token: cc });
  });

  // ─── REJECTION → REOPEN → RESUBMIT ────────────────────────────────────
  it("REJECTION: reject records the reason, creator reopens and resubmits", async () => {
    const cc = await tokenFor("cc");
    const apm = await tokenFor("apm");
    const mda = await tokenFor("mda");

    const created = await expectStatus("POST", "/api/forms/form1", 201, { token: cc, body: await form1Body() });
    const id = created.body.id;
    await expectStatus("PATCH", `/api/forms/form1/${id}/submit`, 200, { token: cc });
    await expectStatus("PATCH", `/api/forms/form1/${id}/approve`, 200, { token: apm, body: { approved: false, remarks: "qty mismatch" } });

    // rejected-records view shows it (MDA can see)
    const rejected = await expectStatus("GET", "/api/mda/rejected-records", 200, { token: mda });
    const rec = rejected.body.find((r: any) => r.originalTransactionId === id);
    expect(rec).toBeTruthy();
    expect(rec.formType).toBe("Form1");
    expect(rec.rejectionRemarks).toBe("qty mismatch");

    // creator reopens → back to Draft → resubmit → approve
    await expectStatus("PATCH", `/api/forms/form1/${id}/reopen`, 200, { token: cc });
    const got = await expectStatus("GET", `/api/forms/form1/${id}`, 200, { token: cc });
    expect(got.body.status).toBe("Draft");

    await expectStatus("PATCH", `/api/forms/form1/${id}/submit`, 200, { token: cc });
    const appr = await expectStatus("PATCH", `/api/forms/form1/${id}/approve`, 200, { token: apm, body: { approved: true } });
    expect(appr.body.status).toBe("Approved");
  });

  // ─── SETTINGS (config + email templates) ──────────────────────────────
  it("SETTINGS: config and email template CRUD (Admin/MDA only)", async () => {
    const mda = await tokenFor("mda");
    const cc = await tokenFor("cc");

    const configs = await expectStatus("GET", "/api/settings/config", 200, { token: mda });
    expect(Array.isArray(configs.body)).toBe(true);
    const smtp = configs.body.find((k: any) => k.key === "smtp_host");
    expect(smtp).toBeTruthy();

    // update + restore
    await expectStatus("PUT", "/api/settings/config/smtp_host", 200, { token: mda, body: { value: "smtp.updated.test" } });
    const after = await expectStatus("GET", "/api/settings/config", 200, { token: mda });
    expect(after.body.find((k: any) => k.key === "smtp_host").value).toBe("smtp.updated.test");
    await expectStatus("PUT", "/api/settings/config/smtp_host", 200, { token: mda, body: { value: smtp.value } });

    // templates list + update + restore
    const templates = await expectStatus("GET", "/api/settings/templates", 200, { token: mda });
    expect(templates.body.length).toBeGreaterThan(0);
    const t = templates.body[0];
    await expectStatus("PUT", `/api/settings/templates/${t.id}`, 200, { token: mda, body: { subject: "Updated Subject" } });
    const t2 = await expectStatus("GET", "/api/settings/templates", 200, { token: mda });
    expect(t2.body.find((x: any) => x.id === t.id).subject).toBe("Updated Subject");
    await expectStatus("PUT", `/api/settings/templates/${t.id}`, 200, { token: mda, body: { subject: t.subject } });

    // non-admin → 403
    await expectStatus("GET", "/api/settings/config", 403, { token: cc });
  });

  // ─── CSV EXPORT ───────────────────────────────────────────────────────
  it("EXPORT: stock, audit, and form CSV downloads", async () => {
    const cc = await tokenFor("cc");
    const po = await tokenFor("po");

    const stock = await api("GET", "/api/export/stock.csv", { token: cc });
    expect(stock.status).toBe(200);
    expect(String(stock.body)).toContain("sourceTxnType");

    const audit = await api("GET", "/api/export/audit.csv", { token: po });
    expect(audit.status).toBe(200);
    expect(String(audit.body)).toContain("performedAt");

    const forms = await api("GET", "/api/export/forms/6", { token: cc });
    expect(forms.status).toBe(200);
    expect(String(forms.body)).toContain("vdvkCode");

    // unknown form type → 404
    await expectStatus("GET", "/api/export/forms/99", 404, { token: cc });
  });

  // ─── PROFILE EDIT ─────────────────────────────────────────────────────
  it("PROFILE: update name/mobile/designation, reflected in /me", async () => {
    const cc = await tokenFor("cc");
    const me = await expectStatus("GET", "/api/auth/me", 200, { token: cc });
    const original = me.body.name;

    await expectStatus("PATCH", "/api/auth/profile", 200, { token: cc, body: { name: "Renamed CC" } });
    const me2 = await expectStatus("GET", "/api/auth/me", 200, { token: cc });
    expect(me2.body.name).toBe("Renamed CC");

    await expectStatus("PATCH", "/api/auth/profile", 200, { token: cc, body: { name: original } });

    // invalid body → 400
    await expectStatus("PATCH", "/api/auth/profile", 400, { token: cc, body: { name: "" } });
  });

  // ─── FORM 6 CSV IMPORT ────────────────────────────────────────────────
  it("IMPORT: form6 CSV import creates beneficiaries and reports row errors", async () => {
    const mda = await tokenFor("mda");
    const tag = uniq("CSV");
    const csv = [
      "vdvkCode,name,age,gender,mandal,commodities",
      `VDK-001,${tag} Ben One,30,Male,MND-001,CMD-001`,
      `VDK-001,${tag} Ben Two,45,Female,MND-001,CMD-001;CMD-002`,
      "VDK-001,,25,Female,MND-001,", // missing name → failed row
    ].join("\n");

    const fd = new FormData();
    fd.append("file", new File([csv], "bens.csv", { type: "text/csv" }));
    const res = await app.request("/api/forms/form6/import", {
      method: "POST",
      headers: { Authorization: `Bearer ${mda}` },
      body: fd,
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.imported).toBe(2);
    expect(body.failed.length).toBe(1);
    expect(body.failed[0].row).toBe(4); // header = row 1

    // they show up in the beneficiary list (Draft)
    const list = await expectStatus("GET", "/api/forms/form6", 200, { token: mda, query: { status: "Draft" } });
    const names = list.body.filter((b: any) => b.name.startsWith(tag));
    expect(names.length).toBe(2);
  });
});
