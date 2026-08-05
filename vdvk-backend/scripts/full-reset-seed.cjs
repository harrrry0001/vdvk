require("dotenv/config");
const { readFileSync } = require("fs");

const TOKEN = process.env.TURSO_AUTH_TOKEN;
const URL = "https://vdvk-gurveer.aws-ap-south-1.turso.io/v2/pipeline";

async function exec(sql) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ type: "execute", stmt: { sql } }] }),
  });
  const data = await res.json();
  if (data.results?.[0]?.type === "error") throw new Error(data.results[0].error.message);
  return data.results?.[0]?.response?.result;
}

async function execMany(statements) {
  const requests = statements.map(sql => ({ type: "execute", stmt: { sql } }));
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  const data = await res.json();
  for (const r of data.results || []) {
    if (r.type === "error") throw new Error(r.error.message + " in: " + statements[data.results.indexOf(r)]?.substring(0, 100));
  }
}

async function main() {
  console.log("=== FULL DB RESET & SEED ===\n");

  // 1. Drop all tables (reverse FK order)
  const dropOrder = [
    "stock_movement_log","stock_ledger","notification_log","notifications","rejected_records","audit_trail","migration_log",
    "form12_visit_photos","form12_field_visits","form10_expenditure_items","form10_fund_utilisation",
    "form9_training_items","form9_trainings","form8_utilisation_items","form8_utilisation",
    "form4_sales_packaging","form4_sales_items","form4_sales",
    "form3_packaging_details","form3_processing_items","form3_processing",
    "form2_transfer_items","form2_stock_transfers",
    "form1_collection_items","form1_collections",
    "machinery_transfers","machinery",
    "facility_supervisors","facility_commodities","facility_vdvk_mapping","facilities",
    "beneficiary_commodities","beneficiaries",
    "vdvk_commodities","vdvks",
    "commodity_rates","grades","commodities",
    "expenditure_heads","customers","suppliers",
    "schemes","villages","mandals","districts","states",
    "system_config","email_templates",
    "user_roles","user_transfer_history","user_sessions","users",
  ];

  console.log("Dropping all tables...");
  // Drop in batches of 10
  for (let i = 0; i < dropOrder.length; i += 10) {
    const batch = dropOrder.slice(i, i + 10);
    await execMany(batch.map(t => `DROP TABLE IF EXISTS [${t}]`));
  }
  console.log("All tables dropped.\n");

  // 2. Read and execute migration SQL
  console.log("Reading migration SQL...");
  const migration = readFileSync(__dirname + "/combined-migration.sql", "utf8");
  const stmts = migration.split("--> statement-breakpoint").map(s => s.trim()).filter(s => s);
  console.log(`${stmts.length} statements to execute...`);

  for (let i = 0; i < stmts.length; i += 15) {
    const batch = stmts.slice(i, i + 15);
    try {
      await execMany(batch);
      process.stdout.write(`\rTables: ${Math.min(i + 15, stmts.length)}/${stmts.length}`);
    } catch (e) {
      console.error(`\nFailed at batch ${i}:`, e.message);
      process.exit(1);
    }
  }
  console.log("\n52 tables created.\n");

  // 3. Seed data
  console.log("Seeding data...\n");
  const bcrypt = require("bcryptjs");
  const pw = await bcrypt.hash("Vdvk@2025", 10);
  const t = (s) => s.replace(/'/g, "''");

  const seedSql = [
    // GEO
    "INSERT INTO states (code,name,status) VALUES ('AP','Andhra Pradesh','Active')",
    "INSERT INTO districts (code,state_code,name,status) VALUES ('DIST-ASR','AP','Alluri Sitarama Raju','Active')",
    ...[["MND-001","Rampachodavaram"],["MND-002","Maredumilli"],["MND-003","Chintoor"],["MND-004","Araku"],["MND-005","Dumbriguda"],["MND-006","Paderu"],["MND-007","Ananthagiri"],["MND-008","G.K. Veedhi"],["MND-009","Pedabayalu"],["MND-010","Munchingput"],["MND-011","Hukumpeta"]].map(([c,n]) => `INSERT INTO mandals (code,district_code,name,status) VALUES ('${c}','DIST-ASR','${n}','Active')`),

    // SCHEMES
    "INSERT INTO schemes (code,name,effective_from,status) VALUES ('SCH-001','PMJVM','2025-04-01','Active')",
    "INSERT INTO schemes (code,name,effective_from,status) VALUES ('SCH-002','PM JANMAN','2025-04-01','Active')",

    // COMMODITIES
    ...[["CMD-001","Turmeric","Kg"],["CMD-002","Honey","Pieces"],["CMD-003","Tamarind","Kg"],["CMD-004","Mahua Flowers","Both"],["CMD-005","Bamboo Baskets","Pieces"],["CMD-006","Turmeric Powder","Kg"]].map(([c,n,u]) => `INSERT INTO commodities (code,name,default_unit,unit_effective_from,status) VALUES ('${c}','${n}','${u}','2025-04-01','Active')`),

    // GRADES
    ...[["GRD-001","CMD-001","A"],["GRD-002","CMD-001","B"],["GRD-003","CMD-002","A"],["GRD-004","CMD-003","A"],["GRD-005","CMD-004","A"],["GRD-006","CMD-005","Default"],["GRD-007","CMD-002","B"]].map(([c,cc,n]) => `INSERT INTO grades (code,commodity_code,grade_name,effective_from) VALUES ('${c}','${cc}','${n}','2025-04-01')`),

    // RATES
    ...[["CMD-001","GRD-001","Kg",120,"NULL"],["CMD-001","GRD-002","Kg",105,"NULL"],["CMD-002","GRD-003","Pieces","NULL",350],["CMD-003","GRD-004","Kg",55,"NULL"],["CMD-004","GRD-005","Both",60,40],["CMD-005","GRD-006","Pieces","NULL",180]].map(([cc,gc,u,kg,pc]) => `INSERT INTO commodity_rates (commodity_code,grade_code,unit,rate_per_kg,rate_per_piece,effective_from) VALUES ('${cc}','${gc}','${u}',${kg},${pc},'2025-04-01')`),

    // EXPENDITURE HEADS
    ...[["EXP-001","Logistics & Transportation",0],["EXP-002","Packaging Material",0],["EXP-003","Electricity Charges",0],["EXP-004","Processing Cost",1],["EXP-005","Training Expenses",1],["EXP-006","Machinery Procurement",1],["EXP-007","Office Expenses",0],["EXP-008","Miscellaneous",0]].map(([c,n,ex]) => `INSERT INTO expenditure_heads (code,name,effective_from,excluded_from_processing,status) VALUES ('${c}','${n}','2025-04-01',${ex},'Active')`),

    // CUSTOMERS
    "INSERT INTO customers (code,name,mobile,address,gst_no,effective_from) VALUES ('CUST-001','ABC Traders','9876543210','Kakinada','37ABCDE1234F1Z5','2025-04-01')",
    "INSERT INTO customers (code,name,mobile,address,effective_from) VALUES ('CUST-002','Girijan Coop','9876543211','Rampachodavaram','2025-04-01')",
    "INSERT INTO customers (code,name,mobile,address,effective_from) VALUES ('CUST-003','Local Buyer - Ravi','9876543212','Paderu','2025-06-01')",

    // SUPPLIERS
    ...[["SUP-001","ABC Engineering","Ravi Kumar","9876543210","abc@gmail.com"],["SUP-002","Solar Tech Pvt. Ltd.","Mahesh","9988776655","solar@gmail.com"],["SUP-003","Precision Scale Co.","Suresh","9123456789","support@psc.com"]].map(([c,n,cp,m,em]) => `INSERT INTO suppliers (code,name,contact_person,mobile,email,effective_from) VALUES ('${c}','${n}','${cp}','${m}','${em}','2025-04-01')`),

    // VDVKs
    ...[["VDK-001","SCH-001","Rampachodavaram VDVK","MND-001",50,500000,300000],["VDK-002","SCH-002","Maredumilli VDVK","MND-002",35,400000,250000],["VDK-003","SCH-001","Chintoor VDVK","MND-003",42,450000,280000]].map(([c,sc,n,md,bc,sa,ra]) => `INSERT INTO vdvks (code,scheme_code,name,state,district,mandal,sanction_date,beneficiary_count,amount_sanctioned,amount_released,status,approved_by,approved_at,created_by,created_at,updated_at) VALUES ('${c}','${sc}','${n}','Andhra Pradesh','Alluri Sitarama Raju','${md}','2025-04-01',${bc},${sa},${ra},'Approved','USER-DPM','2025-04-01T10:00:00.000Z','USER-MDA','${now}','${now}')`),

    // VDVK COMMODITIES
    ...[["VDK-001","CMD-001"],["VDK-001","CMD-002"],["VDK-001","CMD-003"],["VDK-002","CMD-002"],["VDK-002","CMD-004"],["VDK-003","CMD-001"],["VDK-003","CMD-003"],["VDK-003","CMD-005"]].map(([v,c]) => `INSERT INTO vdvk_commodities (vdvk_code,commodity_code) VALUES ('${v}','${c}')`),

    // BENEFICIARIES
    ...[["BEN-001","VDK-001","Ramu",38,"Male","MND-004","Bulk"],["BEN-002","VDK-001","Lakshmi",41,"Female","MND-004","Bulk"],["BEN-003","VDK-002","Somulu",35,"Male","MND-005","Bulk"],["BEN-004","VDK-003","Bheemanna",42,"Male","MND-003","Individual"],["BEN-005","VDK-001","Venkatesh",28,"Male","MND-001","Individual"],["BEN-006","VDK-002","Lalitha",33,"Female","MND-002","Individual"],["BEN-007","VDK-003","Prakash",45,"Male","MND-006","Bulk"],["BEN-008","VDK-001","Gowri",39,"Female","MND-004","Bulk"]].map(([id,v,n,a,g,md,m]) => `INSERT INTO beneficiaries (id,vdvk_code,name,age,gender,mandal,status,registration_mode,created_by,created_at,updated_at) VALUES ('${id}','${v}','${n}',${a},'${g}','${md}','Approved','${m}','USER-MDA','${now}','${now}')`),

    // BENEFICIARY COMMODITIES
    ...[["BEN-001","CMD-003"],["BEN-001","CMD-001"],["BEN-002","CMD-002"],["BEN-003","CMD-005"],["BEN-003","CMD-004"],["BEN-004","CMD-003"],["BEN-005","CMD-001"],["BEN-006","CMD-002"],["BEN-007","CMD-005"],["BEN-008","CMD-001"],["BEN-008","CMD-003"]].map(([b,c]) => `INSERT INTO beneficiary_commodities (beneficiary_id,commodity_code) VALUES ('${b}','${c}')`),

    // FACILITIES
    ...[["FAC-HUB-001","Hub","Rampachodavaram Hub","MND-001"],["FAC-HUB-002","Hub","Maredumilli Hub","MND-002"],["FAC-MPC-001","Multipurpose Centre","Maredumilli Collection Centre","MND-002"],["FAC-HBZ-001","Haat Bazaar","Chintoor Haat Bazaar","MND-003"],["FAC-MPC-002","Multipurpose Centre","Araku Collection Centre","MND-004"]].map(([c,t,n,md]) => `INSERT INTO facilities (code,type,name,mandal,status,created_by,created_at,updated_at) VALUES ('${c}','${t}','${n}','${md}','Approved','USER-MDA','${now}','${now}')`),

    // FACILITY VDVK
    ...[["FAC-HUB-001","VDK-001"],["FAC-HUB-002","VDK-002"],["FAC-MPC-001","VDK-002"],["FAC-HBZ-001","VDK-003"],["FAC-MPC-002","VDK-001"]].map(([f,v]) => `INSERT INTO facility_vdvk_mapping (facility_code,vdvk_code) VALUES ('${f}','${v}')`),

    // FACILITY COMMODITIES
    ...[["FAC-HUB-001","CMD-001"],["FAC-HUB-001","CMD-002"],["FAC-HUB-001","CMD-003"],["FAC-HUB-002","CMD-002"],["FAC-HUB-002","CMD-004"],["FAC-HBZ-001","CMD-001"],["FAC-HBZ-001","CMD-005"],["FAC-MPC-001","CMD-002"],["FAC-MPC-002","CMD-001"]].map(([f,c]) => `INSERT INTO facility_commodities (facility_code,commodity_code) VALUES ('${f}','${c}')`),

    // FACILITY SUPERVISORS
    ...[["FAC-HUB-001","USER-HUB-SUP","Hub Supervisor","2025-04-01"],["FAC-HUB-002","USER-HUB-SUP","Hub Supervisor","2025-04-01"],["FAC-MPC-001","USER-HUB-SUP","Hub Supervisor","2025-06-01"],["FAC-HBZ-001","USER-HUB-SUP","Hub Supervisor","2025-04-01"],["FAC-MPC-002","USER-HUB-SUP","Hub Supervisor","2025-04-01"]].map(([f,u,n,af]) => `INSERT INTO facility_supervisors (facility_code,supervisor_user_id,supervisor_name_snapshot,assigned_from) VALUES ('${f}','${u}','${n}','${af}')`),

    // MACHINERY
    `INSERT INTO machinery (id,name,commodity_mapping,current_facility_code,installation_location,mandal,quantity,unit_cost,total_cost,purchase_date,supplier_code,supplier_name_snapshot,supplier_contact_person,supplier_mobile,supplier_email,warranty_available,warranty_type,warranty_period,warranty_start_date,warranty_expiry_date,funding_source,reason_purpose,current_status,status,source,approved_by,approved_at,created_by,created_at,updated_at) VALUES ('MACH-001','Pulverizer','[\"CMD-001\"]','FAC-HUB-001','Hub','MND-001',1,90000,90000,'2026-06-15','SUP-001','ABC Engineering','Ravi Kumar','9876543210','abc@gmail.com',1,'Warranty','24 Months','2026-06-15','2028-06-14','PMJVM','Turmeric Processing','Available','Approved','Form7','USER-DPM','2025-04-01T10:00:00.000Z','USER-MDA','${now}','${now}')`,
    `INSERT INTO machinery (id,name,commodity_mapping,current_facility_code,installation_location,mandal,quantity,unit_cost,total_cost,purchase_date,supplier_code,supplier_name_snapshot,supplier_contact_person,supplier_mobile,supplier_email,warranty_available,warranty_type,warranty_period,warranty_start_date,warranty_expiry_date,funding_source,reason_purpose,current_status,status,source,approved_by,approved_at,created_by,created_at,updated_at) VALUES ('MACH-002','Pulverizer','[\"CMD-003\"]','FAC-HUB-001','Hub','MND-001',1,110000,110000,'2026-06-15','SUP-001','ABC Engineering','Ravi Kumar','9876543210','abc@gmail.com',1,'Warranty','24 Months','2026-06-15','2028-06-14','PMJVM','Tamarind Processing','Available','Approved','Form7','USER-DPM','2025-04-01T10:00:00.000Z','USER-MDA','${now}','${now}')`,
    `INSERT INTO machinery (id,name,commodity_mapping,current_facility_code,installation_location,mandal,quantity,unit_cost,total_cost,purchase_date,supplier_code,supplier_name_snapshot,supplier_contact_person,supplier_mobile,supplier_email,warranty_available,warranty_type,warranty_period,warranty_start_date,warranty_expiry_date,funding_source,reason_purpose,current_status,status,source,approved_by,approved_at,created_by,created_at,updated_at) VALUES ('MACH-003','Solar Dryer','[\"CMD-002\"]','FAC-MPC-001','Collection Centre','MND-002',1,240000,240000,'2026-06-18','SUP-002','Solar Tech Pvt. Ltd.','Mahesh','9988776655','solar@gmail.com',1,'Warranty','36 Months','2026-06-18','2029-06-17','MoTA','Honey Drying','Available','Approved','Form7','USER-DPM','2025-04-01T10:00:00.000Z','USER-MDA','${now}','${now}')`,
    `INSERT INTO machinery (id,name,commodity_mapping,current_facility_code,installation_location,mandal,quantity,unit_cost,total_cost,purchase_date,supplier_code,supplier_name_snapshot,supplier_contact_person,supplier_mobile,supplier_email,warranty_available,warranty_type,warranty_period,warranty_start_date,warranty_expiry_date,funding_source,reason_purpose,current_status,status,source,approved_by,approved_at,created_by,created_at,updated_at) VALUES ('MACH-004','Weighing Machine','[\"CMD-001\",\"CMD-003\",\"CMD-005\"]','FAC-HBZ-001','Haat Bazaar','MND-003',3,15000,45000,'2026-07-05','SUP-003','Precision Scale Co.','Suresh','9123456789','support@psc.com',1,'Warranty','12 Months','2026-07-05','2027-07-04','PM JANMAN','Procurement Operations','Available','Approved','Form7','USER-DPM','2025-04-01T10:00:00.000Z','USER-MDA','${now}','${now}')`,
    `INSERT INTO machinery (id,name,commodity_mapping,current_facility_code,installation_location,mandal,quantity,unit_cost,total_cost,purchase_date,supplier_code,supplier_name_snapshot,supplier_contact_person,supplier_mobile,supplier_email,warranty_available,warranty_type,warranty_period,warranty_start_date,warranty_expiry_date,funding_source,reason_purpose,current_status,status,source,approved_by,approved_at,created_by,created_at,updated_at) VALUES ('MACH-005','Bottle Filler','[\"CMD-002\"]','FAC-MPC-001','Collection Centre','MND-002',1,85000,85000,'2026-04-10','SUP-001','ABC Engineering','Ravi Kumar','9876543210','abc@gmail.com',1,'Guarantee','18 Months','2026-04-10','2027-10-09','PMJVM','Honey Bottling','Available','Approved','Form7','USER-DPM','2025-04-01T10:00:00.000Z','USER-MDA','${now}','${now}')`,

    // USERS
    `INSERT INTO users (id,name,username,password_hash,designation,mandal,created_at,updated_at) VALUES ('USER-PO','Project Officer','po','${pw}','PO','MND-001','${now}','${now}')`,
    `INSERT INTO users (id,name,username,password_hash,designation,mandal,created_at,updated_at) VALUES ('USER-APD','Addl. Project Director','apd','${pw}','APD','MND-001','${now}','${now}')`,
    `INSERT INTO users (id,name,username,password_hash,designation,mandal,created_at,updated_at) VALUES ('USER-DPM','Divisional Project Manager','dpm','${pw}','DPM','MND-001','${now}','${now}')`,
    `INSERT INTO users (id,name,username,password_hash,designation,mandal,vdvk_code,created_at,updated_at) VALUES ('USER-APM','Asst. PM - Rampa','apm','${pw}','APM','MND-001','VDK-001','${now}','${now}')`,
    `INSERT INTO users (id,name,username,password_hash,designation,mandal,vdvk_code,created_at,updated_at) VALUES ('USER-APM2','Asst. PM - Maredumilli','apm2','${pw}','APM','MND-002','VDK-002','${now}','${now}')`,
    `INSERT INTO users (id,name,username,password_hash,designation,mandal,vdvk_code,created_at,updated_at) VALUES ('USER-CC','Community Coordinator','cc','${pw}','CC','MND-001','VDK-001','${now}','${now}')`,
    `INSERT INTO users (id,name,username,password_hash,designation,mandal,vdvk_code,created_at,updated_at) VALUES ('USER-CC2','Community Coordinator 2','cc2','${pw}','CC','MND-002','VDK-002','${now}','${now}')`,
    `INSERT INTO users (id,name,username,password_hash,designation,mandal,facility_code,created_at,updated_at) VALUES ('USER-HUB-SUP','Hub Supervisor','hubsup','${pw}','Hub Supervisor','MND-001','FAC-HUB-001','${now}','${now}')`,
    `INSERT INTO users (id,name,username,password_hash,designation,mandal,facility_code,created_at,updated_at) VALUES ('USER-HUB-SUP2','Hub Supervisor 2','hubsup2','${pw}','Hub Supervisor','MND-002','FAC-HUB-002','${now}','${now}')`,
    `INSERT INTO users (id,name,username,password_hash,designation,mandal,created_at,updated_at) VALUES ('USER-MDA','Master Data Admin','mda','${pw}','MDA','MND-001','${now}','${now}')`,

    // USER ROLES
    `INSERT INTO user_roles (user_id,role,is_primary,assigned_from) VALUES ('USER-PO','PO',1,'2025-04-01')`,
    `INSERT INTO user_roles (user_id,role,is_primary,assigned_from) VALUES ('USER-APD','APD',1,'2025-04-01')`,
    `INSERT INTO user_roles (user_id,role,is_primary,assigned_from) VALUES ('USER-DPM','DPM',1,'2025-04-01')`,
    `INSERT INTO user_roles (user_id,role,is_primary,assigned_from) VALUES ('USER-APM','APM',1,'2025-04-01')`,
    `INSERT INTO user_roles (user_id,role,is_primary,assigned_from) VALUES ('USER-APM2','APM',1,'2025-04-01')`,
    `INSERT INTO user_roles (user_id,role,is_primary,assigned_from) VALUES ('USER-CC','CC',1,'2025-04-01')`,
    `INSERT INTO user_roles (user_id,role,is_primary,assigned_from) VALUES ('USER-CC2','CC',1,'2025-04-01')`,
    `INSERT INTO user_roles (user_id,role,is_primary,assigned_from) VALUES ('USER-HUB-SUP','Hub Supervisor',1,'2025-04-01')`,
    `INSERT INTO user_roles (user_id,role,is_primary,assigned_from) VALUES ('USER-HUB-SUP2','Hub Supervisor',1,'2025-04-01')`,
    `INSERT INTO user_roles (user_id,role,is_primary,assigned_from) VALUES ('USER-MDA','MDA',1,'2025-04-01')`,
    `INSERT INTO user_roles (user_id,role,is_primary,assigned_from) VALUES ('USER-HUB-SUP','VDVK Facility Supervisor',0,'2025-04-01')`,
    `INSERT INTO user_roles (user_id,role,is_primary,assigned_from) VALUES ('USER-HUB-SUP','Multipurpose Centre Supervisor',0,'2025-04-01')`,
    `INSERT INTO user_roles (user_id,role,is_primary,assigned_from) VALUES ('USER-HUB-SUP','Haat Bazaar Supervisor',0,'2025-04-01')`,

    // SYSTEM CONFIG
    `INSERT INTO system_config (key,value,description) VALUES ('machinery_utilisation_tolerance_pct','5','Tolerance percentage for Form 8 vs Form 3 cross-validation')`,
    `INSERT INTO system_config (key,value,description) VALUES ('escalation_days','7','Working days before request escalation')`,
    `INSERT INTO system_config (key,value,description) VALUES ('pending_attention_days','5','Working days before pending-attention notification')`,
    `INSERT INTO system_config (key,value,description) VALUES ('max_concurrent_sessions','3','Max concurrent user sessions')`,
    `INSERT INTO system_config (key,value,description) VALUES ('max_login_attempts','5','Failed login attempts before lockout')`,
    `INSERT INTO system_config (key,value,description) VALUES ('lockout_duration_minutes','30','Account lockout duration')`,
    `INSERT INTO system_config (key,value,description) VALUES ('smtp_host','','SMTP server hostname')`,
    `INSERT INTO system_config (key,value,description) VALUES ('smtp_port','587','SMTP port')`,
    `INSERT INTO system_config (key,value,description) VALUES ('sender_email','noreply@vdvk-mis.gov.in','From address for system emails')`,
    `INSERT INTO system_config (key,value,description) VALUES ('app_version','1.0.0','Application version')`,

    // EMAIL TEMPLATES
    `INSERT INTO email_templates (template_key,subject,body_html) VALUES ('escalation','Request Escalated - {{txnNo}}','<h2>Escalated</h2><p>Request {{txnNo}} pending {{days}} days.</p>')`,
    `INSERT INTO email_templates (template_key,subject,body_html) VALUES ('pending_attention','Pending Approval - {{txnNo}}','<h2>Pending</h2><p>Request {{txnNo}} needs attention.</p>')`,
    `INSERT INTO email_templates (template_key,subject,body_html) VALUES ('approval_required','Approval - {{txnNo}}','<h2>Approval Required</h2><p>{{formType}} {{txnNo}} requires approval.</p>')`,
  ];

  // Execute seed in batches
  for (let i = 0; i < seedSql.length; i += 10) {
    const batch = seedSql.slice(i, i + 10);
    try {
      await execMany(batch);
      process.stdout.write(`\rSeed: ${Math.min(i + 10, seedSql.length)}/${seedSql.length}`);
    } catch (e) {
      console.error(`\nFailed at seed batch ${i}:`, e.message);
      process.exit(1);
    }
  }

  console.log(`\n\nDone! ${seedSql.length} seed statements executed.`);

  // VERIFY
  console.log("\n=== VERIFICATION ===");
  const counts = await exec("SELECT 'States' as e,count(*) c FROM states UNION ALL SELECT 'Districts',count(*) FROM districts UNION ALL SELECT 'Mandals',count(*) FROM mandals UNION ALL SELECT 'Schemes',count(*) FROM schemes UNION ALL SELECT 'Commodities',count(*) FROM commodities UNION ALL SELECT 'Grades',count(*) FROM grades UNION ALL SELECT 'Rates',count(*) FROM commodity_rates UNION ALL SELECT 'ExpHeads',count(*) FROM expenditure_heads UNION ALL SELECT 'Customers',count(*) FROM customers UNION ALL SELECT 'Suppliers',count(*) FROM suppliers UNION ALL SELECT 'VDVKs',count(*) FROM vdvks UNION ALL SELECT 'VDVK-Cmd',count(*) FROM vdvk_commodities UNION ALL SELECT 'Ben',count(*) FROM beneficiaries UNION ALL SELECT 'Ben-Cmd',count(*) FROM beneficiary_commodities UNION ALL SELECT 'Fac',count(*) FROM facilities UNION ALL SELECT 'Fac-VDK',count(*) FROM facility_vdvk_mapping UNION ALL SELECT 'Fac-Cmd',count(*) FROM facility_commodities UNION ALL SELECT 'Fac-Sup',count(*) FROM facility_supervisors UNION ALL SELECT 'Mach',count(*) FROM machinery UNION ALL SELECT 'Users',count(*) FROM users UNION ALL SELECT 'Roles',count(*) FROM user_roles UNION ALL SELECT 'Config',count(*) FROM system_config UNION ALL SELECT 'Templates',count(*) FROM email_templates");
  if (counts && counts.rows) {
    for (const r of counts.rows) console.log(`  ${String(r.e).padEnd(12)} ${r.c}`);
  }
}

const now = new Date().toISOString();
main().catch(e => { console.error("FAIL:", e.message); process.exit(1); });
