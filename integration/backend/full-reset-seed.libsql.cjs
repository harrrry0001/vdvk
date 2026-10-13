#!/usr/bin/env node
/**
 * full-reset-seed.libsql.cjs — libSQL/Turso port of the canonical Postgres
 * seed vdvk-backend/src/db/seed/seed.cjs (+ data/real-data.cjs).
 *
 * Does exactly what the canonical seed does: wipe every data table (child →
 * parent order) and re-insert the full canonical dataset — geo (state,
 * district, 11 mandals, 188 villages), schemes, commodities/grades/rates,
 * expenditure heads, customers/suppliers, all 106 VDVKs + commodity maps,
 * facilities + mappings, machinery, users (10 demo + 79 real, password
 * Vdvk@2025), roles, system config, email templates.
 *
 * Deliberate differences from the Postgres original (see backend/CHANGES.md):
 *  - no `SET session_replication_role` — SQLite has no equivalent; a
 *    best-effort `PRAGMA foreign_keys=off` runs before the transaction.
 *  - `?::jsonb` casts removed (JSON bound as text; SQLite column affinity
 *    stores it as-is).
 *  - **Demo beneficiaries are SKIPPED by default.** real-data.cjs carries 456
 *    synthetic members (BEN-001..456, generated aadhaar). This database is
 *    being loaded with the real field data (import-members libsql loader), so
 *    seeding them would pollute member counts vs the Member Wise report.
 *    Pass --with-demo-beneficiaries to seed them too.
 *
 * Usage:
 *   node full-reset-seed.libsql.cjs [--with-demo-beneficiaries]
 *
 * DESTRUCTIVE: deletes all rows in all data tables (same as npm run db:seed).
 */
const { createRequire } = require("node:module");
const { connect, bind } = require("./turso-client.cjs");

const VDVK_BACKEND = require("node:path").resolve(__dirname, "..", "..", "vdvk-backend");
const real = createRequire(require("node:path").join(VDVK_BACKEND, "package.json"))(
  require("node:path").join(VDVK_BACKEND, "src", "db", "seed", "data", "real-data.cjs")
);
const bcrypt = createRequire(require("node:path").join(VDVK_BACKEND, "package.json"))("bcryptjs");

const WITH_DEMO = process.argv.includes("--with-demo-beneficiaries");

// child → parent, identical to seed.cjs
const DELETE_TABLES = [
  "notification_log", "notifications", "rejected_records", "audit_trail",
  "stock_movement_log", "stock_ledger", "migration_log",
  "form12_visit_photos", "form12_field_visits",
  "form10_expenditure_items", "form10_fund_utilisation",
  "form9_training_items", "form9_trainings",
  "form8_utilisation_items", "form8_utilisation",
  "form4_sales_packaging", "form4_sales_items", "form4_sales",
  "form3_packaging_details", "form3_processing_items", "form3_processing",
  "form2_transfer_items", "form2_stock_transfers",
  "form1_collection_items", "form1_collections",
  "machinery_transfers", "machinery",
  "facility_supervisors", "facility_commodities", "facility_vdvk_mapping",
  "beneficiary_commodities", "beneficiaries", "vdvk_commodities", "vdvks",
  "facilities", "commodity_rates", "grades", "commodities",
  "expenditure_heads", "customers", "suppliers", "schemes",
  "villages", "mandals", "districts", "states",
  "system_config", "email_templates",
  "user_roles", "user_transfer_history", "user_sessions", "users",
];

async function main() {
  const db = connect();
  console.log("=== VDVK MIS FULL SEED (canonical real-data, libSQL) ===");
  console.log(`demo beneficiaries: ${WITH_DEMO ? "INCLUDED (flag)" : "SKIPPED (default — field data will be loaded)"}\n`);

  try {
    await db.execute("PRAGMA foreign_keys=off").catch(() => {});
  } catch { /* not critical */ }

  const tx = await db.transaction("write");
  try {
    const exec = async (sql, args = []) =>
      tx.execute({ sql, args: args.map(bind) });

    for (const t of DELETE_TABLES) await exec(`DELETE FROM ${t}`);
    console.log(`Cleaned ${DELETE_TABLES.length} tables`);

    const now = new Date().toISOString();

    // 1. GEOGRAPHIC HIERARCHY
    await exec("INSERT INTO states (code,name,status) VALUES (?,?,?)", ["AP", "Andhra Pradesh", "Active"]);
    await exec("INSERT INTO districts (code,state_code,name,status) VALUES (?,?,?,?)", ["DIST-ASR", "AP", "Alluri Sitarama Raju", "Active"]);
    for (const [code, name] of real.mandals) {
      await exec("INSERT INTO mandals (code,district_code,name,status) VALUES (?,?,?,'Active')", [code, "DIST-ASR", name]);
    }
    for (const [code, mc, name, pin] of real.villages) {
      await exec("INSERT INTO villages (code,mandal_code,name,pin_code,status) VALUES (?,?,?,?,'Active')", [code, mc, name, pin]);
    }
    console.log(`[1/11] Geo: 1 state, 1 district, ${real.mandals.length} mandals, ${real.villages.length} villages`);

    // 2. SCHEMES
    for (const [code, name, ef] of real.schemes) {
      await exec("INSERT INTO schemes (code,name,effective_from,status) VALUES (?,?,?,'Active')", [code, name, ef]);
    }
    console.log(`[2/11] Schemes: ${real.schemes.length}`);

    // 3. COMMODITIES + GRADES + RATES
    for (const [c, n, u, ef, st] of real.commodities) {
      await exec("INSERT INTO commodities (code,name,default_unit,unit_effective_from,status) VALUES (?,?,?,?,'Active')", [c, n, u, ef]);
    }
    for (const [c, cc, n] of real.grades) {
      await exec("INSERT INTO grades (code,commodity_code,grade_name,effective_from) VALUES (?,?,?,?)", [c, cc, n, "2025-04-01"]);
    }
    for (const [cc, gc, u, kg, pc, ef, et] of real.rates) {
      await exec(
        "INSERT INTO commodity_rates (commodity_code,grade_code,unit,rate_per_kg,rate_per_piece,effective_from,effective_to) VALUES (?,?,?,?,?,?,?)",
        [cc, gc, u, kg, pc, ef, et]
      );
    }
    console.log(`[3/11] Commodities(${real.commodities.length}) + Grades(${real.grades.length}) + Rates(${real.rates.length})`);

    // 4. EXPENDITURE HEADS
    for (const [c, n, ef, exc] of real.expenditureHeads) {
      await exec(
        "INSERT INTO expenditure_heads (code,name,effective_from,excluded_from_processing,status) VALUES (?,?,?,?,'Active')",
        [c, n, ef, exc]
      );
    }
    console.log(`[4/11] Expenditure Heads: ${real.expenditureHeads.length}`);

    // 5. CUSTOMERS + SUPPLIERS
    for (const [c, n, m, a, g, ef] of real.customers) {
      await exec("INSERT INTO customers (code,name,mobile,address,gst_no,effective_from) VALUES (?,?,?,?,?,?)", [c, n, m, a, g, ef]);
    }
    for (const [c, n, cp, m, em] of real.suppliers) {
      await exec("INSERT INTO suppliers (code,name,contact_person,mobile,email,effective_from) VALUES (?,?,?,?,?,?)", [c, n, cp, m, em, "2025-04-01"]);
    }
    console.log(`[5/11] Customers(${real.customers.length}) + Suppliers(${real.suppliers.length})`);

    // 6. VDVKs + MAPPINGS
    for (const [c, sc, n, md, pin, bc, sa, ra, cmds] of real.vdvks) {
      await exec(
        "INSERT INTO vdvks (code,scheme_code,name,state,district,mandal,pin_code,sanction_date,beneficiary_count,amount_sanctioned,amount_released,status,approved_by,approved_at,created_by,created_at,updated_at) " +
          "VALUES (?,?,?,'Andhra Pradesh','Alluri Sitarama Raju',?,?,?,?,?,?,'Approved','USER-DPM',?,?,?,?)",
        [c, sc, n, md, pin, "2025-04-01", bc, sa, ra, "2025-04-01T10:00:00.000Z", "USER-MDA", now, now]
      );
    }
    // NOTE: repo seed.cjs has a bug here — `for (const [c, cmds] of real.vdvks)`
    // destructures scheme_code as cmds and inserts single characters. cmds is
    // element [8]; fixed here.
    for (const v of real.vdvks) {
      const c = v[0];
      for (const cmd of v[8]) {
        await exec("INSERT INTO vdvk_commodities (vdvk_code,commodity_code) VALUES (?,?)", [c, cmd]);
      }
    }
    console.log(`[6/11] VDVKs(${real.vdvks.length}) + VDVK-Commodity mappings`);

    // 7. BENEFICIARIES + MAPPINGS (demo — skipped unless --with-demo-beneficiaries)
    if (WITH_DEMO) {
      for (const [id, vdk, nm, age, gen, mob, aad, addr, mnd, vil, pin, cat, mode, st, cmds] of real.beneficiaries) {
        await exec(
          "INSERT INTO beneficiaries (id,vdvk_code,name,age,gender,mobile,aadhaar,address,state,district,mandal,village,pin_code,category,registration_mode,status,approved_by,approved_at,created_by,created_at,updated_at) " +
            "VALUES (?,?,?,?,?,?,?,?,'Andhra Pradesh','Alluri Sitarama Raju',?,?,?,?,?,?,'USER-MDA',?,?,?,?)",
          [id, vdk, nm, age, gen, mob, aad, addr, mnd, vil, pin, cat, mode, st, "2025-04-01T10:00:00.000Z", "USER-MDA", now, now]
        );
      }
      for (const [id, cmds] of real.beneficiaries) {
        for (const cmd of cmds) {
          await exec("INSERT INTO beneficiary_commodities (beneficiary_id,commodity_code) VALUES (?,?)", [id, cmd]);
        }
      }
      console.log(`[7/11] Beneficiaries(${real.beneficiaries.length}) + Beneficiary-Commodity mappings`);
    } else {
      console.log(`[7/11] Beneficiaries SKIPPED (demo seed members) — field data loads via import-members`);
    }

    // 8. FACILITIES + MAPPINGS + SUPERVISORS
    for (const [c, t, n, md, addr, pin, doe, ost, stor, proc, machAvail, elec, water, net, infra, fsanc, frel, futl, fbal, cmds, vdvks, supName] of real.facilities) {
      await exec(
        "INSERT INTO facilities (code,type,name,scheme_code,state,district,mandal,village,address,pin_code,date_of_establishment,operational_status,storage_capacity_kg,processing_capacity_kg_per_day,electricity_available,water_facility,internet_connectivity,other_infrastructure,machinery_available,total_fund_sanctioned,total_fund_released,total_fund_utilised,balance_fund,status,created_by,created_at,updated_at) " +
          "VALUES (?,?,?,?,'Andhra Pradesh','Alluri Sitarama Raju',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Approved','USER-MDA',?,?)",
        [c, t, n, "SCH-001", md, null, addr, pin, doe, ost, stor, proc, elec, water, net, infra, machAvail, fsanc, frel, futl, fbal, now, now]
      );
    }
    for (const f of real.facilities) {
      for (const vc of f[20]) {
        await exec("INSERT INTO facility_vdvk_mapping (facility_code,vdvk_code) VALUES (?,?)", [f[0], vc]);
      }
    }
    for (const f of real.facilities) {
      for (const cmd of f[19]) {
        await exec("INSERT INTO facility_commodities (facility_code,commodity_code) VALUES (?,?)", [f[0], cmd]);
      }
    }
    for (const [fc, uid, supName] of real.facilitySupervisors) {
      await exec(
        "INSERT INTO facility_supervisors (facility_code,supervisor_user_id,supervisor_name_snapshot,assigned_from) VALUES (?,?,?,?)",
        [fc, uid, supName, "2025-04-01"]
      );
    }
    console.log(`[8/11] Facilities(${real.facilities.length}) + VDVK-mappings + Commodity-mappings + Supervisors(${real.facilitySupervisors.length})`);

    // 9. MACHINERY (PG `?::jsonb` cast dropped — bound as text)
    for (const [id, name, qty, facCode, loc, vdkCode, mnd, cmds] of real.machinery) {
      await exec(
        "INSERT INTO machinery (id,name,commodity_mapping,current_facility_code,installation_location,current_vdvk_code,mandal,quantity,unit_cost,total_cost,purchase_date,supplier_code,supplier_name_snapshot,supplier_contact_person,supplier_mobile,supplier_email,warranty_available,warranty_type,warranty_period,warranty_start_date,warranty_expiry_date,funding_source,reason_purpose,current_status,status,source,approved_by,approved_at,created_by,created_at,updated_at) " +
          "VALUES (?,?,?,?,?,?,?,?,0,0,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,NULL,NULL,NULL,NULL,NULL,'Available','Approved','Form7','USER-DPM',?,?,?,?)",
        [id, name, JSON.stringify(cmds), facCode, loc, vdkCode, mnd, qty, "2025-04-01T10:00:00.000Z", "USER-MDA", now, now]
      );
    }
    console.log(`[9/11] Machinery: ${real.machinery.length} assets`);

    // 10. USERS + ROLES
    const pw = await bcrypt.hash("Vdvk@2025", 10);
    const userData = [
      { id: "USER-PO", name: "Project Officer", uname: "po", desig: "Project Officer", mandal: "MND-001" },
      { id: "USER-APD", name: "Addl. Project Director", uname: "apd", desig: "APD", mandal: "MND-001" },
      { id: "USER-DPM", name: "Divisional Project Manager", uname: "dpm", desig: "DPM", mandal: "MND-001" },
      { id: "USER-APM", name: "Asst. Project Manager - Rampa", uname: "apm", desig: "APM", mandal: "MND-001", vdvk: "VDK-001" },
      { id: "USER-APM2", name: "Asst. Project Manager - Maredumilli", uname: "apm2", desig: "APM", mandal: "MND-002", vdvk: "VDK-002" },
      { id: "USER-CC", name: "Community Coordinator", uname: "cc", desig: "CC", mandal: "MND-001", vdvk: "VDK-001" },
      { id: "USER-CC2", name: "Community Coordinator 2", uname: "cc2", desig: "CC", mandal: "MND-002", vdvk: "VDK-002" },
      { id: "USER-HUB-SUP", name: "Hub Supervisor", uname: "hubsup", desig: "Hub Supervisor", mandal: "MND-001", facility: "FAC-HUB-001" },
      { id: "USER-HUB-SUP2", name: "Hub Supervisor 2", uname: "hubsup2", desig: "Hub Supervisor", mandal: "MND-002", facility: "FAC-HUB-002" },
      { id: "USER-MDA", name: "Admin", uname: "mda", desig: "MDA", mandal: "MND-001" },
    ];
    for (const u of userData) {
      const cols = ["id", "name", "username", "password_hash", "designation", "mandal", "created_at", "updated_at"];
      const vals = [u.id, u.name, u.uname, pw, u.desig, u.mandal, now, now];
      if (u.vdvk) { cols.push("vdvk_code"); vals.push(u.vdvk); }
      if (u.facility) { cols.push("facility_code"); vals.push(u.facility); }
      await exec(`INSERT INTO users (${cols.join(",")}) VALUES (${vals.map(() => "?").join(",")})`, vals);
    }
    for (const [id, name, uname, desig, mob, em, mnd, role] of real.realUsers) {
      await exec(
        "INSERT INTO users (id,name,username,password_hash,designation,mobile,email,mandal,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,'Active',?,?)",
        [id, name, uname, pw, desig, mob, em, mnd, now, now]
      );
    }
    const roleData = [
      ["USER-PO", "PO"], ["USER-APD", "APD"], ["USER-DPM", "DPM"],
      ["USER-APM", "APM"], ["USER-APM2", "APM"],
      ["USER-CC", "CC"], ["USER-CC2", "CC"],
      ["USER-HUB-SUP", "Hub Supervisor"], ["USER-HUB-SUP2", "Hub Supervisor"],
      ["USER-MDA", "MDA"],
    ];
    for (const [uid, r] of roleData) {
      await exec("INSERT INTO user_roles (user_id,role,is_primary,assigned_from) VALUES (?,?,1,?)", [uid, r, "2025-04-01"]);
    }
    for (const [id, , , , , , , role] of real.realUsers) {
      await exec("INSERT INTO user_roles (user_id,role,is_primary,assigned_from) VALUES (?,?,1,?)", [id, role, "2025-04-01"]);
    }
    await exec("INSERT INTO user_roles (user_id,role,is_primary,assigned_from) VALUES (?,?,0,?)", ["USER-HUB-SUP", "VDVK Facility Supervisor", "2025-04-01"]);
    await exec("INSERT INTO user_roles (user_id,role,is_primary,assigned_from) VALUES (?,?,0,?)", ["USER-HUB-SUP", "MPC Supervisor", "2025-04-01"]);
    await exec("INSERT INTO user_roles (user_id,role,is_primary,assigned_from) VALUES (?,?,0,?)", ["USER-HUB-SUP", "Haat Bazaar Supervisor", "2025-04-01"]);
    console.log(`[10/11] Users(${userData.length + real.realUsers.length}) + Roles [password: Vdvk@2025]`);

    // 11. SYSTEM CONFIG + EMAIL TEMPLATES
    const configs = [
      ["machinery_utilisation_tolerance_pct", "5", "Tolerance % for Form 8 vs Form 3 cross-validation"],
      ["escalation_days", "7", "Working days before a request is escalated"],
      ["pending_attention_days", "5", "Working days before pending-attention notification"],
      ["max_concurrent_sessions", "3", "Maximum concurrent user sessions allowed"],
      ["max_login_attempts", "5", "Failed login attempts before account lockout"],
      ["lockout_duration_minutes", "30", "Account lockout duration in minutes"],
      ["jwt_access_expiry_minutes", "15", "JWT access token expiry in minutes"],
      ["jwt_refresh_expiry_days", "7", "JWT refresh token expiry in days"],
      ["default_currency", "INR", "Default currency for financial reports"],
      ["smtp_host", "", "SMTP server hostname for email alerts"],
      ["smtp_port", "587", "SMTP port"],
      ["sender_email", "noreply@vdvk-mis.gov.in", "From address for system emails"],
      ["app_name", "VDVK MIS", "Application display name"],
      ["app_version", "1.0.0", "Current application version"],
    ];
    for (const [k, v, d] of configs) {
      await exec("INSERT INTO system_config (key,value,description) VALUES (?,?,?)", [k, v, d]);
    }
    const emailTemplates = [
      ["escalation", "Request Escalated - Action Required",
        "<h2>Request Escalated</h2><p>Request <strong>{{txnNo}}</strong> has been pending for {{days}} days.</p><p>Please review: <a href='{{url}}'>{{url}}</a></p>"],
      ["pending_attention", "Request Pending Attention",
        "<h2>Pending Approval</h2><p>Request <strong>{{txnNo}}</strong> has been pending for {{days}} days.</p><p>Please review: <a href='{{url}}'>{{url}}</a></p>"],
      ["approval_required", "Approval Request - {{txnNo}}",
        "<h2>Approval Required</h2><p>A new {{formType}} request ({{txnNo}}) requires your approval.</p>"],
    ];
    for (const [k, s, b] of emailTemplates) {
      await exec("INSERT INTO email_templates (template_key,subject,body_html) VALUES (?,?,?)", [k, s, b]);
    }
    console.log("[11/11] System Config(14) + Email Templates(3)");

    await tx.commit();

    // VERIFY
    const counts = await db.execute(`
      SELECT 'States' as entity, count(*) as cnt FROM states
      UNION ALL SELECT 'Districts', count(*) FROM districts
      UNION ALL SELECT 'Mandals', count(*) FROM mandals
      UNION ALL SELECT 'Villages', count(*) FROM villages
      UNION ALL SELECT 'Schemes', count(*) FROM schemes
      UNION ALL SELECT 'Commodities', count(*) FROM commodities
      UNION ALL SELECT 'Grades', count(*) FROM grades
      UNION ALL SELECT 'Rates', count(*) FROM commodity_rates
      UNION ALL SELECT 'ExpHeads', count(*) FROM expenditure_heads
      UNION ALL SELECT 'Customers', count(*) FROM customers
      UNION ALL SELECT 'Suppliers', count(*) FROM suppliers
      UNION ALL SELECT 'VDVKs', count(*) FROM vdvks
      UNION ALL SELECT 'VDVK-CmdMap', count(*) FROM vdvk_commodities
      UNION ALL SELECT 'Beneficiaries', count(*) FROM beneficiaries
      UNION ALL SELECT 'Ben-CmdMap', count(*) FROM beneficiary_commodities
      UNION ALL SELECT 'Facilities', count(*) FROM facilities
      UNION ALL SELECT 'Fac-VDVKMap', count(*) FROM facility_vdvk_mapping
      UNION ALL SELECT 'Fac-CmdMap', count(*) FROM facility_commodities
      UNION ALL SELECT 'Fac-Sup', count(*) FROM facility_supervisors
      UNION ALL SELECT 'Machinery', count(*) FROM machinery
      UNION ALL SELECT 'Users', count(*) FROM users
      UNION ALL SELECT 'UserRoles', count(*) FROM user_roles
      UNION ALL SELECT 'SysConfig', count(*) FROM system_config
      UNION ALL SELECT 'EmailTmpl', count(*) FROM email_templates
    `);
    console.log("\n=== VERIFICATION ===");
    for (const row of counts.rows) console.log(`  ${String(row.entity).padEnd(15)} ${row.cnt}`);
    console.log("\nSeed complete.");
  } catch (e) {
    await tx.rollback().catch(() => {});
    console.error("\nERROR (rolled back):", (e && e.message ? e.message : String(e)).split("\n")[0]);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();
